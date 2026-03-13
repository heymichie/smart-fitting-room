import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { fittingRoomsTable } from "@workspace/db/schema";
import { randomUUID } from "crypto";

const router: IRouter = Router();

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
    roomId,
    branchCode,
    name,
    location: location ?? "",
    status: status ?? "available",
  }).returning();
  res.status(201).json(room);
});

router.patch("/fitting-rooms/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { location, status, name } = req.body;
  const [room] = await db.update(fittingRoomsTable)
    .set({ ...(location !== undefined && { location }), ...(status !== undefined && { status }), ...(name !== undefined && { name }) })
    .where(eq(fittingRoomsTable.id, id))
    .returning();
  if (!room) { res.status(404).json({ error: "Room not found" }); return; }
  res.json(room);
});

router.delete("/fitting-rooms/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(fittingRoomsTable).where(eq(fittingRoomsTable.id, id));
  res.status(204).end();
});

export default router;
