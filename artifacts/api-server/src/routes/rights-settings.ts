import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { rightsSettingsTable } from "@workspace/db/schema";

const router: IRouter = Router();

async function getOrCreateSettings() {
  const rows = await db.select().from(rightsSettingsTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(rightsSettingsTable).values({}).returning();
  return created;
}

router.get("/rights-settings", async (_req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  res.json(settings);
});

router.put("/rights-settings", async (req, res): Promise<void> => {
  const body = req.body;
  const existing = await getOrCreateSettings();

  const [updated] = await db
    .update(rightsSettingsTable)
    .set({
      smRespondAlert:         body.smRespondAlert         ?? existing.smRespondAlert,
      smOpenDoor:             body.smOpenDoor             ?? existing.smOpenDoor,
      smClearEntrance:        body.smClearEntrance        ?? existing.smClearEntrance,
      smSpoolReports:         body.smSpoolReports         ?? existing.smSpoolReports,
      ssRespondAlert:         body.ssRespondAlert         ?? existing.ssRespondAlert,
      ssOpenDoor:             body.ssOpenDoor             ?? existing.ssOpenDoor,
      ssClearEntrance:        body.ssClearEntrance        ?? existing.ssClearEntrance,
      ssSpoolReports:         body.ssSpoolReports         ?? existing.ssSpoolReports,
      adminCreateAccounts:    body.adminCreateAccounts    ?? existing.adminCreateAccounts,
      adminSetupFittingRooms: body.adminSetupFittingRooms ?? existing.adminSetupFittingRooms,
      adminSpoolReports:      body.adminSpoolReports      ?? existing.adminSpoolReports,
    })
    .where(eq(rightsSettingsTable.id, existing.id))
    .returning();

  res.json(updated);
});

export default router;
