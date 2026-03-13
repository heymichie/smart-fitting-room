import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { CreateUserBody, UpdateUserBody, UpdateUserParams } from "@workspace/api-zod";
import { randomUUID, randomBytes } from "crypto";
import { sendWelcomeEmail } from "../utils/email.js";

const router: IRouter = Router();

function getAppBaseUrl(req: any): string {
  const host = req.get("host") ?? "localhost:8080";
  const protocol = req.protocol ?? "http";
  return `${protocol}://${host}`;
}

router.get("/users", async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, parsed.data.username)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }

  const userId = randomUUID().toUpperCase().replace(/-/g, "").slice(0, 10);

  // Generate a 48-hour password-setup token
  const passwordResetToken = randomBytes(32).toString("hex");
  const passwordResetTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const [user] = await db.insert(usersTable).values({
    userId,
    ...parsed.data,
    mustChangePassword: true,
    passwordResetToken,
    passwordResetTokenExpiry,
  }).returning();

  const appBaseUrl = getAppBaseUrl(req);
  const setupLink = `${appBaseUrl}/user-login?token=${passwordResetToken}`;

  // Attempt email (currently a no-op stub — logs only)
  if (user.email) {
    await sendWelcomeEmail({
      to: user.email,
      forenames: user.forenames,
      username: user.username,
      resetToken: passwordResetToken,
      appBaseUrl,
    });
  }

  res.status(201).json({ ...user, setupLink });
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

router.patch("/users/:id", async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // If re-activating a previously deactivated user, refresh their reset token
  const updateData: Record<string, any> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.isActive === true) {
    updateData.mustChangePassword = true;
    updateData.passwordResetToken = randomBytes(32).toString("hex");
    updateData.passwordResetTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
  }

  const [user] = await db.update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Send welcome email if user is being re-activated and has an email
  if (parsed.data.isActive === true && user.email && user.passwordResetToken) {
    const appBaseUrl = getAppBaseUrl(req);
    await sendWelcomeEmail({
      to: user.email,
      forenames: user.forenames,
      username: user.username,
      resetToken: user.passwordResetToken,
      appBaseUrl,
    });
  }

  res.json(user);
});

export default router;
