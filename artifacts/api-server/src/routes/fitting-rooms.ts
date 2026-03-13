import { Router, type IRouter, type Response } from "express";
import { eq, asc } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { fittingRoomsTable } from "@workspace/db/schema";
import { randomUUID } from "crypto";

const router: IRouter = Router();

/* ─── SSE client registry ────────────────────────────────────────────────── */
// Map<branchCode, Set<Response>>
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

/* ─── SSE subscription endpoint ──────────────────────────────────────────── */
router.get("/fitting-rooms/events", (req, res): void => {
  const branchCode = req.query.branchCode as string;
  if (!branchCode) { res.status(400).json({ error: "branchCode required" }); return; }

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Send a heartbeat every 25 s to keep the connection alive through proxies
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

  const { status, source } = req.body;
  const valid = ["available", "occupied", "alert"];
  if (!status || !valid.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${valid.join(", ")}` });
    return;
  }

  const [room] = await db
    .update(fittingRoomsTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(fittingRoomsTable.id, id))
    .returning();

  if (!room) { res.status(404).json({ error: "Room not found" }); return; }

  // Broadcast to all dashboard clients watching this branch
  broadcast(room.branchCode, "status-update", {
    id:        room.id,
    roomId:    room.roomId,
    name:      room.name,
    status:    room.status,
    source:    source ?? "iot",
    timestamp: new Date().toISOString(),
  });

  res.json(room);
});

/* ─── Existing CRUD endpoints ────────────────────────────────────────────── */
router.get("/fitting-rooms/branches", async (_req, res): Promise<void> => {
  const rows = await db
    .selectDistinct({ branchCode: usersTable.storeBranchCode })
    .from(usersTable)
    .orderBy(usersTable.storeBranchCode);
  res.json(rows.map(r => r.branchCode));
});

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

router.patch("/fitting-rooms/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { location, status, name } = req.body;
  const [room] = await db.update(fittingRoomsTable)
    .set({
      ...(location !== undefined && { location }),
      ...(status   !== undefined && { status   }),
      ...(name     !== undefined && { name     }),
    })
    .where(eq(fittingRoomsTable.id, id))
    .returning();
  if (!room) { res.status(404).json({ error: "Room not found" }); return; }

  // Also broadcast manual admin updates
  if (status !== undefined) {
    broadcast(room.branchCode, "status-update", {
      id: room.id, roomId: room.roomId, name: room.name,
      status: room.status, source: "admin",
      timestamp: new Date().toISOString(),
    });
  }

  res.json(room);
});

router.delete("/fitting-rooms/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(fittingRoomsTable).where(eq(fittingRoomsTable.id, id));
  res.status(204).end();
});

export default router;
