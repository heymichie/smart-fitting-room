import { Router, type IRouter } from "express";
import { eq, desc, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import { fittingRoomSessionsTable } from "@workspace/db/schema";

const router: IRouter = Router();

router.get("/fitting-room-sessions", async (req, res): Promise<void> => {
  const { branchCode, page = "1", limit = "50" } = req.query;
  if (!branchCode || typeof branchCode !== "string") {
    res.status(400).json({ error: "branchCode query param required" });
    return;
  }

  const pageNum  = Math.max(1, parseInt(page as string, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
  const offset   = (pageNum - 1) * pageSize;

  const [sessions, countRow] = await Promise.all([
    db.select()
      .from(fittingRoomSessionsTable)
      .where(eq(fittingRoomSessionsTable.branchCode, branchCode))
      .orderBy(asc(fittingRoomSessionsTable.mainEntranceEntryTime))
      .limit(pageSize)
      .offset(offset),

    db.$count(fittingRoomSessionsTable, eq(fittingRoomSessionsTable.branchCode, branchCode)),
  ]);

  res.json({
    data:       sessions,
    total:      countRow,
    page:       pageNum,
    pageSize,
    totalPages: Math.max(1, Math.ceil(Number(countRow) / pageSize)),
  });
});

router.post("/fitting-room-sessions", async (req, res): Promise<void> => {
  const {
    branchCode, mainEntranceEntryTime, customerId, garmentCount,
    productCodesIn, fittingRoomName, fittingRoomEntryTime, fittingRoomExitTime,
    durationMinutes, alertTime, alertAttendantId, mainEntranceExitTime,
    mainEntranceAlertTime, productCodesOut, checkoutAttendantId, hasAlert,
  } = req.body;

  if (!branchCode) { res.status(400).json({ error: "branchCode is required" }); return; }

  const [session] = await db.insert(fittingRoomSessionsTable).values({
    branchCode,
    mainEntranceEntryTime: mainEntranceEntryTime ?? null,
    customerId:            customerId            ?? null,
    garmentCount:          garmentCount          ?? null,
    productCodesIn:        productCodesIn        ?? null,
    fittingRoomName:       fittingRoomName       ?? null,
    fittingRoomEntryTime:  fittingRoomEntryTime  ?? null,
    fittingRoomExitTime:   fittingRoomExitTime   ?? null,
    durationMinutes:       durationMinutes       ?? null,
    alertTime:             alertTime             ?? null,
    alertAttendantId:      alertAttendantId      ?? null,
    mainEntranceExitTime:  mainEntranceExitTime  ?? null,
    mainEntranceAlertTime: mainEntranceAlertTime ?? null,
    productCodesOut:       productCodesOut       ?? null,
    checkoutAttendantId:   checkoutAttendantId   ?? null,
    hasAlert:              hasAlert              ?? false,
  }).returning();

  res.status(201).json(session);
});

router.patch("/fitting-room-sessions/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const allowed = [
    "mainEntranceEntryTime", "customerId", "garmentCount", "productCodesIn",
    "fittingRoomName", "fittingRoomEntryTime", "fittingRoomExitTime", "durationMinutes",
    "alertTime", "alertAttendantId", "mainEntranceExitTime", "mainEntranceAlertTime",
    "productCodesOut", "checkoutAttendantId", "hasAlert", "isActive",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" }); return;
  }

  const [session] = await db.update(fittingRoomSessionsTable)
    .set(updates)
    .where(eq(fittingRoomSessionsTable.id, id))
    .returning();

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  res.json(session);
});

export default router;
