import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, adminTable } from "@workspace/db";
import { CreateAdminSetupBody, GetAdminSetupStatusResponse } from "@workspace/api-zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.get("/admin/setup", async (_req, res): Promise<void> => {
  const admins = await db.select().from(adminTable).limit(1);
  const setupComplete = admins.length > 0;
  res.json(GetAdminSetupStatusResponse.parse({ setupComplete }));
});

router.post("/admin/setup", async (req, res): Promise<void> => {
  const parsed = CreateAdminSetupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { organisationTradingName, administratorForenames, surname, designation, username, password, retypePassword, productCode } = parsed.data;

  if (password !== retypePassword) {
    res.status(400).json({ error: "Passwords do not match" });
    return;
  }

  const existing = await db.select().from(adminTable).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Administrator setup has already been completed" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const organisationalId = randomUUID().toUpperCase().replace(/-/g, "").slice(0, 12);

  const [admin] = await db.insert(adminTable).values({
    organisationalId,
    organisationTradingName,
    administratorForenames,
    surname,
    designation,
    username,
    passwordHash,
    productCode,
    isActive: true,
  }).returning();

  res.status(201).json({
    organisationalId: admin.organisationalId,
    organisationTradingName: admin.organisationTradingName,
    administratorForenames: admin.administratorForenames,
    surname: admin.surname,
    designation: admin.designation,
    username: admin.username,
    message: "Administrator account created successfully",
  });
});

export default router;
