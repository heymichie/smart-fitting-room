import { Router, type IRouter, type Response } from "express";
import { eq, asc } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { fittingRoomsTable } from "@workspace/db/schema";
import { randomUUID } from "crypto";

const router: IRouter = Router();

/* ─── SSE client registry ────────────────────────────────────────────────── */
const sseClients = new Map<string, Set<Response>>();

function addClient(branchCode: string, res: Response) {
  if (!sseClients.has(branchCode)) sseClients.set(branchCode, new Set());
  sseClients.get(branchCode)!.add(res);
}

function removeClient(branchCode: string, res: Response) {
  sseClients.get(branchCode)?.delete(res);
}

function broadcast(branchCode: string, event: string, data: unknown) {
  const clients = sseClients.get(branchCode);
  if (!clients || clients.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try { client.write(payload); } catch { /* client disconnected */ }
  }
}

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

/* ─── IoT / RFID status push ─────────────────────────────────────────────── */
router.post("/fitting-rooms/:id/status", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { status, source, garmentCount } = req.body;
  const valid = ["available", "occupied", "alert"];
  if (!status || !valid.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${valid.join(", ")}` });
    return;
  }

  const [existing] = await db.select().from(fittingRoomsTable).where(eq(fittingRoomsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Room not found" }); return; }

  const updates = buildStatusUpdate(existing, status, garmentCount);
  const [room] = await db.update(fittingRoomsTable).set(updates).where(eq(fittingRoomsTable.id, id)).returning();

  broadcast(room.branchCode, "status-update", {
    id:             room.id,
    roomId:         room.roomId,
    name:           room.name,
    status:         room.status,
    occupiedSince:  room.occupiedSince,
    alertSince:     room.alertSince,
    lastOccupiedAt: room.lastOccupiedAt,
    garmentCount:   room.garmentCount,
    source:         source ?? "iot",
    timestamp:      new Date().toISOString(),
  });

  res.json(room);
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
  res.json(rooms);
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

export default router;
