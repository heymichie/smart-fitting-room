import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "sfr-dev-secret-change-in-production";
const USER_JWT_SECRET = process.env.USER_JWT_SECRET ?? "sfr-user-dev-secret-change-in-production";

const router: IRouter = Router();

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

// First-time password setup
router.post("/user-auth/set-password", async (req, res): Promise<void> => {
  const { username, newPassword, retypePassword } = req.body ?? {};
  if (!username || typeof username !== "string") {
    res.status(400).json({ error: "username is required" }); return;
  }
  if (!newPassword || typeof newPassword !== "string") {
    res.status(400).json({ error: "newPassword is required" }); return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" }); return;
  }
  if (!retypePassword || typeof retypePassword !== "string") {
    res.status(400).json({ error: "retypePassword is required" }); return;
  }

  if (newPassword !== retypePassword) {
    res.status(400).json({ error: "Passwords do not match" });
    return;
  }

  const [user] = await db
    .select()
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

  if (user.passwordHash) {
    res.status(409).json({ error: "Password already set — please log in normally" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const [updated] = await db
    .update(usersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id))
    .returning();

  const token = jwt.sign(
    { userId: updated.id, username: updated.username, rights: updated.rights, branchCode: updated.storeBranchCode },
    USER_JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.status(201).json({
    token,
    userId:    updated.userId,
    username:  updated.username,
    forenames: updated.forenames,
    surname:   updated.surname,
    rights:    updated.rights,
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
    res.status(400).json({ error: "No password set — please complete first-time sign in" });
    return;
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, rights: user.rights, branchCode: user.storeBranchCode },
    USER_JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({
    token,
    userId:    user.userId,
    username:  user.username,
    forenames: user.forenames,
    surname:   user.surname,
    rights:    user.rights,
    branchCode: user.storeBranchCode,
  });
});

export default router;
