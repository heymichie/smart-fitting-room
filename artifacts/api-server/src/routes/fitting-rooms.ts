import { Router, type IRouter } from "express";
import { eq, asc, desc, and } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { fittingRoomsTable, fittingRoomSessionsTable } from "@workspace/db/schema";
import { randomUUID } from "crypto";
import { addSseClient, removeSseClient, broadcastRoomEvent } from "../lib/roomEvents";

const router: IRouter = Router();

const addClient    = addSseClient;
const removeClient = removeSseClient;
const broadcast    = (bc: string, ev: string, data: unknown) => broadcastRoomEvent(bc, ev, data);

/* ─── Derive timestamp updates for status transitions ─────────────────────── */
function buildStatusUpdate(
  currentRoom: { status: string; occupiedSince: Date | null; lastOccupiedAt: Date | null },
  newStatus: string,
  garmentCount?: number | null,
) {
  const now = new Date();
  const base: Record<string, unknown> = { status: newStatus, updatedAt: now };

  if (garmentCount !== undefined && garmentCount !== null) {
    base.garmentCount = garmentCount;
  }

  if (newStatus === "occupied") {
    base.occupiedSince  = now;
    base.lastOccupiedAt = now;
    base.alertSince     = null;
  } else if (newStatus === "alert") {
    base.alertSince = now;
    if (!currentRoom.occupiedSince) base.occupiedSince = now;
    base.lastOccupiedAt = currentRoom.lastOccupiedAt ?? now;
  } else {
    base.lastOccupiedAt = currentRoom.occupiedSince ?? currentRoom.lastOccupiedAt ?? null;
    base.occupiedSince  = null;
    base.alertSince     = null;
    if (!garmentCount) base.garmentCount = null;
  }

  return base;
}

/* ─── SSE subscription endpoint ──────────────────────────────────────────── */
router.get("/fitting-rooms/events", (req, res): void => {
  const branchCode = req.query.branchCode as string;
  if (!branchCode) { res.status(400).json({ error: "branchCode required" }); return; }

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); }
  }, 25000);

  addClient(branchCode, res);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeClient(branchCode, res);
  });
});

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/** Parse a product-codes value that may be JSON array, CSV string, or raw array */
function parseCodes(raw: unknown): string[] {
  if (Array.isArray(raw)) return (raw as string[]).map(String);
  if (typeof raw === "string") {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p.map(String); } catch {}
    return raw.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [];
}

/** Compare two code lists in a quantity-aware, order-independent way */
function codesMatch(a: string[], b: string[]): boolean {
  const sort = (arr: string[]) => [...arr].sort();
  return JSON.stringify(sort(a)) === JSON.stringify(sort(b));
}

/* ─── IoT / RFID status push ─────────────────────────────────────────────── */
/**
 * POST /api/fitting-rooms/:id/status
 *
 * Body fields:
 *   status         "occupied" | "available" | "alert"
 *   source         optional label, e.g. "rfid"
 *   garmentCount   number of garments (entry or exit count)
 *   productCodes   string[] | JSON-string array — product codes scanned
 *   exitGarmentCount  explicit exit count (overrides garmentCount when present on exit)
 *
 * Response includes:
 *   doorOpen       boolean — true = unlock door, false = keep locked
 *   varianceAlert  boolean — true = mismatch detected
 *   mismatch       object  — details of discrepancy (when varianceAlert)
 */
router.post("/fitting-rooms/:id/status", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { status, source, garmentCount, exitGarmentCount: bodyExitCount, productCodes } = req.body;
  const valid = ["available", "occupied", "alert"];
  if (!status || !valid.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${valid.join(", ")}` });
    return;
  }

  const [existing] = await db.select().from(fittingRoomsTable).where(eq(fittingRoomsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Room not found" }); return; }

  // Normalise incoming product codes
  const scannedCodes = parseCodes(productCodes);
  const codesJson    = scannedCodes.length ? JSON.stringify(scannedCodes) : null;

  // Resolve counts
  const entryCount: number | undefined = status === "occupied" && garmentCount !== undefined ? Number(garmentCount) : undefined;
  const exitCount:  number | undefined =
    bodyExitCount !== undefined
      ? Number(bodyExitCount)
      : status === "available" && garmentCount !== undefined
        ? Number(garmentCount)
        : undefined;

  // Find the most recent active session for this room
  const [activeSession] = await db
    .select()
    .from(fittingRoomSessionsTable)
    .where(and(
      eq(fittingRoomSessionsTable.branchCode, existing.branchCode),
      eq(fittingRoomSessionsTable.fittingRoomName, existing.name),
      eq(fittingRoomSessionsTable.isActive, true),
    ))
    .orderBy(desc(fittingRoomSessionsTable.createdAt))
    .limit(1);

  const now     = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  let finalStatus    = status;
  let isVarianceAlert = false;
  let doorOpen        = true;          // door always opens on entry
  let mismatch: Record<string, unknown> | null = null;

  // ── ENTRY scan (customer entering fitting room) ───────────────────────────
  if (status === "occupied" && activeSession) {
    const sessionUpdates: Record<string, unknown> = {
      fittingRoomEntryTime:      timeStr,
      fittingRoomEntryScannedAt: now,
    };
    if (entryCount !== undefined)  sessionUpdates.garmentCount           = entryCount;
    if (codesJson !== null)        sessionUpdates.fittingRoomProductCodesIn = codesJson;

    await db
      .update(fittingRoomSessionsTable)
      .set(sessionUpdates)
      .where(eq(fittingRoomSessionsTable.id, activeSession.id));
    // Door always opens on entry
    doorOpen = true;
  }

  // ── EXIT scan (customer attempting to leave fitting room) ─────────────────
  if (status === "available" && activeSession) {
    const sessionUpdates: Record<string, unknown> = {
      fittingRoomExitTime:       timeStr,
      fittingRoomExitScannedAt:  now,
    };
    if (exitCount !== undefined) sessionUpdates.exitGarmentCount        = exitCount;
    if (codesJson !== null)      sessionUpdates.fittingRoomProductCodesOut = codesJson;

    // ── Comparison ──────────────────────────────────────────────────────────
    const sessionEntryCount  = activeSession.garmentCount;
    const sessionEntryCodes  = parseCodes(activeSession.fittingRoomProductCodesIn ?? "");

    const quantityOk = exitCount === undefined || sessionEntryCount === null || exitCount === sessionEntryCount;
    const codesOk    = scannedCodes.length === 0 || sessionEntryCodes.length === 0 || codesMatch(sessionEntryCodes, scannedCodes);

    if (!quantityOk || !codesOk) {
      // Mismatch — door stays locked, trigger alert
      finalStatus     = "alert";
      isVarianceAlert = true;
      doorOpen        = false;
      mismatch = {
        entryCount:  sessionEntryCount,
        exitCount:   exitCount ?? null,
        entryCodes:  sessionEntryCodes,
        exitCodes:   scannedCodes,
        quantityOk,
        codesOk,
      };
      sessionUpdates.hasAlert  = true;
      sessionUpdates.alertTime = timeStr;
    } else {
      // Perfect match — door opens, session closes
      doorOpen = true;
      sessionUpdates.isActive        = false;
      sessionUpdates.durationMinutes = activeSession.fittingRoomEntryTime
        ? (() => {
            const hh = parseInt(activeSession.fittingRoomEntryTime!.slice(0, -2), 10);
            const mm = parseInt(activeSession.fittingRoomEntryTime!.slice(-2),    10);
            const entry = new Date(now);
            entry.setHours(hh, mm, 0, 0);
            return Math.max(0, Math.round((now.getTime() - entry.getTime()) / 60000));
          })()
        : null;
    }

    await db
      .update(fittingRoomSessionsTable)
      .set(sessionUpdates)
      .where(eq(fittingRoomSessionsTable.id, activeSession.id));
  }

  // Build room update — for variance alerts keep existing garmentCount
  const roomGarmentCount = finalStatus === "occupied" ? entryCount : undefined;
  const updates = buildStatusUpdate(existing, finalStatus, roomGarmentCount);
  if (isVarianceAlert) delete (updates as Record<string, unknown>).garmentCount;

  const [room] = await db.update(fittingRoomsTable).set(updates).where(eq(fittingRoomsTable.id, id)).returning();

  broadcast(room.branchCode, "status-update", {
    id:            room.id,
    roomId:        room.roomId,
    name:          room.name,
    status:        room.status,
    occupiedSince: room.occupiedSince,
    alertSince:    room.alertSince,
    lastOccupiedAt: room.lastOccupiedAt,
    garmentCount:  room.garmentCount,
    source:        source ?? "iot",
    varianceAlert: isVarianceAlert,
    doorOpen,
    timestamp:     now.toISOString(),
  });

  res.json({ ...room, doorOpen, varianceAlert: isVarianceAlert, mismatch });
});

/* ─── Branches list ──────────────────────────────────────────────────────── */
router.get("/fitting-rooms/branches", async (_req, res): Promise<void> => {
  const rows = await db
    .selectDistinct({ branchCode: usersTable.storeBranchCode })
    .from(usersTable)
    .orderBy(usersTable.storeBranchCode);
  res.json(rows.map(r => r.branchCode));
});

/* ─── List rooms for a branch ────────────────────────────────────────────── */
router.get("/fitting-rooms", async (req, res): Promise<void> => {
  const { branchCode } = req.query;
  if (!branchCode || typeof branchCode !== "string") {
    res.status(400).json({ error: "branchCode query param required" });
    return;
  }
  const rooms = await db
    .select()
    .from(fittingRoomsTable)
    .where(eq(fittingRoomsTable.branchCode, branchCode))
    .orderBy(asc(fittingRoomsTable.createdAt));

  // Enrich each room with session-derived status and times
  const enriched = await Promise.all(rooms.map(async (room) => {
    const roomCondition = and(
      eq(fittingRoomSessionsTable.branchCode, branchCode),
      eq(fittingRoomSessionsTable.fittingRoomName, room.name),
    );

    // 1. Check for an active (no exit) session
    const [activeSession] = await db
      .select({
        fittingRoomEntryTime: fittingRoomSessionsTable.fittingRoomEntryTime,
      })
      .from(fittingRoomSessionsTable)
      .where(and(roomCondition, eq(fittingRoomSessionsTable.isActive, true)))
      .orderBy(desc(fittingRoomSessionsTable.createdAt))
      .limit(1);

    if (activeSession) {
      // Active session exists — keep DB status, expose entry time for duration
      return {
        ...room,
        activeEntryTime:     activeSession.fittingRoomEntryTime ?? null,
        sessionLastExitTime: null,
      };
    }

    // 2. No active session — find the latest closed session by exit time
    const [lastClosed] = await db
      .select({ fittingRoomExitTime: fittingRoomSessionsTable.fittingRoomExitTime })
      .from(fittingRoomSessionsTable)
      .where(and(roomCondition, eq(fittingRoomSessionsTable.isActive, false)))
      .orderBy(desc(fittingRoomSessionsTable.fittingRoomExitTime))
      .limit(1);

    return {
      ...room,
      status:              "available" as const,
      activeEntryTime:     null,
      sessionLastExitTime: lastClosed?.fittingRoomExitTime ?? null,
    };
  }));

  res.json(enriched);
});

/* ─── Create room ────────────────────────────────────────────────────────── */
router.post("/fitting-rooms", async (req, res): Promise<void> => {
  const { branchCode, name, location, status } = req.body;
  if (!branchCode || !name) {
    res.status(400).json({ error: "branchCode and name are required" });
    return;
  }
  const roomId = "FR-" + randomUUID().toUpperCase().replace(/-/g, "").slice(0, 8);
  const [room] = await db.insert(fittingRoomsTable).values({
    roomId, branchCode, name,
    location: location ?? "",
    status:   status   ?? "available",
  }).returning();
  res.status(201).json(room);
});

/* ─── Update room (admin) ────────────────────────────────────────────────── */
router.patch("/fitting-rooms/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { location, status, name, garmentCount } = req.body;

  let statusUpdates: Record<string, unknown> = {};
  if (status !== undefined) {
    const [existing] = await db.select().from(fittingRoomsTable).where(eq(fittingRoomsTable.id, id)).limit(1);
    if (existing && existing.status !== status) {
      statusUpdates = buildStatusUpdate(existing, status, garmentCount);
    }
  }

  const [room] = await db.update(fittingRoomsTable)
    .set({
      ...(location !== undefined && { location }),
      ...(name !== undefined && { name }),
      ...(garmentCount !== undefined && { garmentCount }),
      ...statusUpdates,
    })
    .where(eq(fittingRoomsTable.id, id))
    .returning();

  if (!room) { res.status(404).json({ error: "Room not found" }); return; }

  if (status !== undefined) {
    broadcast(room.branchCode, "status-update", {
      id: room.id, roomId: room.roomId, name: room.name,
      status: room.status,
      occupiedSince:  room.occupiedSince,
      alertSince:     room.alertSince,
      lastOccupiedAt: room.lastOccupiedAt,
      garmentCount:   room.garmentCount,
      source: "admin",
      timestamp: new Date().toISOString(),
    });
  }

  res.json(room);
});

/* ─── Delete room ────────────────────────────────────────────────────────── */
router.delete("/fitting-rooms/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(fittingRoomsTable).where(eq(fittingRoomsTable.id, id));
  res.status(204).end();
});

/* ─── Main Fitting Room Entrance IoT scan ────────────────────────────────── */
/**
 * POST /api/fitting-rooms/entrance
 *
 * Called by the RFID/IoT device at the MAIN fitting room entrance.
 *
 * Body:
 *   direction      "in"  — customer entering the fitting room area
 *                  "out" — customer trying to leave
 *   sessionId      number  — DB id of the active session
 *   branchCode     string
 *   productCodes   string[] | JSON string — product codes scanned
 *   garmentCount   number
 *   source         optional, e.g. "rfid"
 *
 * Response includes:
 *   doorOpen       boolean — true = unlock door
 *   varianceAlert  boolean — true = mismatch detected
 *   mismatch       object | null
 */
router.post("/fitting-rooms/entrance", async (req, res): Promise<void> => {
  const { direction, sessionId, branchCode, productCodes, garmentCount, source } = req.body;

  if (!direction || !["in", "out"].includes(direction)) {
    res.status(400).json({ error: "direction must be 'in' or 'out'" });
    return;
  }
  if (!sessionId || !branchCode) {
    res.status(400).json({ error: "sessionId and branchCode are required" });
    return;
  }

  const sid = Number(sessionId);
  if (isNaN(sid)) { res.status(400).json({ error: "Invalid sessionId" }); return; }

  const [session] = await db
    .select()
    .from(fittingRoomSessionsTable)
    .where(eq(fittingRoomSessionsTable.id, sid))
    .limit(1);

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  if (session.branchCode !== branchCode) { res.status(403).json({ error: "Branch code mismatch" }); return; }

  const scannedCodes = parseCodes(productCodes);
  const codesJson    = scannedCodes.length ? JSON.stringify(scannedCodes) : null;
  const now          = new Date();
  const timeStr      = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  // ── ENTRY ─────────────────────────────────────────────────────────────────
  if (direction === "in") {
    const upd: Record<string, unknown> = {
      mainEntranceEntryTime:       timeStr,
      mainEntranceEntryScannedAt:  now,
    };
    if (garmentCount !== undefined) upd.garmentCount             = Number(garmentCount);
    if (codesJson !== null)         upd.mainEntranceProductCodesIn = codesJson;

    await db
      .update(fittingRoomSessionsTable)
      .set(upd)
      .where(eq(fittingRoomSessionsTable.id, sid));

    res.json({ doorOpen: true, varianceAlert: false, mismatch: null });
    return;
  }

  // ── EXIT ──────────────────────────────────────────────────────────────────
  const entryCodes  = parseCodes(session.mainEntranceProductCodesIn ?? session.productCodesIn ?? "");
  const entryCount  = session.garmentCount;

  const quantityOk  = garmentCount === undefined || entryCount === null || Number(garmentCount) === entryCount;
  const codesOk     = scannedCodes.length === 0 || entryCodes.length === 0 || codesMatch(entryCodes, scannedCodes);

  const upd: Record<string, unknown> = {
    mainEntranceExitTime:        timeStr,
    mainEntranceExitScannedAt:   now,
    mainEntranceProductCodesOut: codesJson,
  };
  if (garmentCount !== undefined) upd.exitGarmentCount = Number(garmentCount);

  let doorOpen        = true;
  let isVarianceAlert = false;
  let mismatch: Record<string, unknown> | null = null;

  if (!quantityOk || !codesOk) {
    doorOpen        = false;
    isVarianceAlert = true;
    upd.mainEntranceAlertTime = timeStr;
    upd.hasAlert              = true;
    mismatch = {
      entryCount:  entryCount,
      exitCount:   garmentCount !== undefined ? Number(garmentCount) : null,
      entryCodes,
      exitCodes:   scannedCodes,
      quantityOk,
      codesOk,
    };
  }

  const [updated] = await db
    .update(fittingRoomSessionsTable)
    .set(upd)
    .where(eq(fittingRoomSessionsTable.id, sid))
    .returning();

  if (isVarianceAlert && updated) {
    broadcast(branchCode, "entrance-alert", {
      sessionId:   updated.id,
      branchCode:  updated.branchCode,
      customerId:  updated.customerId,
      alertTime:   timeStr,
      entryCodes,
      exitCodes:   scannedCodes,
      entryCount:  entryCount,
      exitCount:   garmentCount !== undefined ? Number(garmentCount) : null,
      quantityOk,
      codesOk,
      cctvClipUrl: null,
      source:      source ?? "rfid",
      timestamp:   now.toISOString(),
    });
  }

  res.json({ doorOpen, varianceAlert: isVarianceAlert, mismatch, beep: isVarianceAlert });
});

/* ─── Resolve a main entrance alert ─────────────────────────────────────── */
router.post("/fitting-rooms/entrance/resolve", async (req, res): Promise<void> => {
  const { sessionId } = req.body;
  const sid = Number(sessionId);
  if (isNaN(sid)) { res.status(400).json({ error: "Invalid sessionId" }); return; }

  const now = new Date();
  const [updated] = await db
    .update(fittingRoomSessionsTable)
    .set({ mainEntranceAlertResolvedAt: now })
    .where(eq(fittingRoomSessionsTable.id, sid))
    .returning();

  if (!updated) { res.status(404).json({ error: "Session not found" }); return; }

  broadcast(updated.branchCode, "entrance-alert-resolved", {
    sessionId: updated.id,
    resolvedAt: now.toISOString(),
  });

  res.json({ ok: true, resolvedAt: now.toISOString() });
});

/* ─── CCTV clip push (called by CCTV system when clip is ready) ─────────── */
router.post("/fitting-rooms/entrance/cctv", async (req, res): Promise<void> => {
  const { sessionId, clipUrl, branchCode } = req.body;
  const sid = Number(sessionId);
  if (isNaN(sid) || !clipUrl) {
    res.status(400).json({ error: "sessionId and clipUrl are required" });
    return;
  }

  const [updated] = await db
    .update(fittingRoomSessionsTable)
    .set({ cctvClipUrl: String(clipUrl) })
    .where(eq(fittingRoomSessionsTable.id, sid))
    .returning();

  if (!updated) { res.status(404).json({ error: "Session not found" }); return; }

  // Notify dashboard so CCTV clip appears without refresh
  if (branchCode) {
    broadcast(String(branchCode), "entrance-cctv-ready", {
      sessionId: updated.id,
      cctvClipUrl: updated.cctvClipUrl,
    });
  }

  res.json({ ok: true });
});

export default router;
