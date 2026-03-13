import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "../utils/email.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "sfr-dev-secret-change-in-production";
const USER_JWT_SECRET = process.env.USER_JWT_SECRET ?? "sfr-user-dev-secret-change-in-production";

const router: IRouter = Router();

function getAppBaseUrl(req: any): string {
  const host = req.get("host") ?? "localhost:8080";
  const protocol = req.protocol ?? "http";
  return `${protocol}://${host}`;
}

// Check whether a username exists and whether a password has been set
router.get("/user-auth/check", async (req, res): Promise<void> => {
  const username = (req.query.username as string | undefined)?.trim();
  if (!username) {
    res.status(400).json({ error: "username query param required" });
    return;
  }

  const [user] = await db
    .select({ id: usersTable.id, passwordHash: usersTable.passwordHash, isActive: usersTable.isActive })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "Account is disabled" });
    return;
  }

  res.json({ exists: true, passwordSet: user.passwordHash !== null });
});

// Verify a password-reset token (from the emailed link)
router.get("/user-auth/verify-reset-token", async (req, res): Promise<void> => {
  const token = (req.query.token as string | undefined)?.trim();
  if (!token) {
    res.status(400).json({ error: "token query param required" });
    return;
  }

  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      forenames: usersTable.forenames,
      passwordResetToken: usersTable.passwordResetToken,
      passwordResetTokenExpiry: usersTable.passwordResetTokenExpiry,
      isActive: usersTable.isActive,
    })
    .from(usersTable)
    .where(eq(usersTable.passwordResetToken, token))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Invalid or expired link. Please contact your store manager." });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "Account is disabled." });
    return;
  }

  if (!user.passwordResetTokenExpiry || user.passwordResetTokenExpiry < new Date()) {
    res.status(410).json({ error: "This link has expired. Please contact your store manager." });
    return;
  }

  res.json({ valid: true, username: user.username, forenames: user.forenames });
});

// Set password via reset token (first-time setup OR forgot-password flow)
router.post("/user-auth/reset-password", async (req, res): Promise<void> => {
  const { token, newPassword, retypePassword } = req.body ?? {};

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token is required" }); return;
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" }); return;
  }
  if (newPassword !== retypePassword) {
    res.status(400).json({ error: "Passwords do not match" }); return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.passwordResetToken, token))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Invalid or expired link." }); return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "Account is disabled." }); return;
  }

  if (!user.passwordResetTokenExpiry || user.passwordResetTokenExpiry < new Date()) {
    res.status(410).json({ error: "This link has expired. Please contact your store manager." }); return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  const [updated] = await db
    .update(usersTable)
    .set({
      passwordHash,
      mustChangePassword: false,
      passwordResetToken: null,
      passwordResetTokenExpiry: null,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, user.id))
    .returning();

  const sessionToken = jwt.sign(
    { userId: updated.id, username: updated.username, rights: updated.rights, branchCode: updated.storeBranchCode },
    USER_JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.status(201).json({
    token: sessionToken,
    userId: updated.userId,
    username: updated.username,
    forenames: updated.forenames,
    surname: updated.surname,
    rights: updated.rights,
    branchCode: updated.storeBranchCode,
  });
});

// Returning-user login
router.post("/user-auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body ?? {};
  if (!username || typeof username !== "string") {
    res.status(400).json({ error: "username is required" }); return;
  }
  if (!password || typeof password !== "string") {
    res.status(400).json({ error: "password is required" }); return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({ error: "Account is disabled" });
    return;
  }

  if (!user.passwordHash) {
    res.status(400).json({ error: "No password set — please use the link sent to your email" });
    return;
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  // If the user must change their password, issue a fresh reset token and redirect them
  if (user.mustChangePassword) {
    const resetToken = randomBytes(32).toString("hex");
    const resetExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await db.update(usersTable)
      .set({ passwordResetToken: resetToken, passwordResetTokenExpiry: resetExpiry, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    res.status(200).json({ mustChangePassword: true, resetToken });
    return;
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, rights: user.rights, branchCode: user.storeBranchCode },
    USER_JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({
    token,
    userId: user.userId,
    username: user.username,
    forenames: user.forenames,
    surname: user.surname,
    rights: user.rights,
    branchCode: user.storeBranchCode,
  });
});

// Request a password reset (forgot password — sends email)
router.post("/user-auth/forgot-password", async (req, res): Promise<void> => {
  const { username } = req.body ?? {};
  if (!username || typeof username !== "string") {
    res.status(400).json({ error: "username is required" }); return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username.trim()))
    .limit(1);

  // Always return 200 to avoid user enumeration
  if (!user || !user.isActive || !user.email) {
    res.json({ message: "If your account exists, a reset link has been sent to your email." });
    return;
  }

  const resetToken = randomBytes(32).toString("hex");
  const resetExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await db.update(usersTable)
    .set({ passwordResetToken: resetToken, passwordResetTokenExpiry: resetExpiry, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  const appBaseUrl = getAppBaseUrl(req);
  await sendPasswordResetEmail({
    to: user.email,
    forenames: user.forenames,
    username: user.username,
    resetToken,
    appBaseUrl,
  });

  res.json({ message: "If your account exists, a reset link has been sent to your email." });
});

export default router;
