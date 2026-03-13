/**
 * One-off script: set default password "password" for all users who don't have one.
 * Sets mustChangePassword = true and generates a reset token (48h expiry).
 * Run: pnpm --filter @workspace/scripts run seed-default-passwords
 */

import { db, usersTable } from "@workspace/db";
import { isNull, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const DEFAULT_PASSWORD = "password";

async function main() {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const noPassword = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(isNull(usersTable.passwordHash));

  if (noPassword.length === 0) {
    console.log("All users already have a password set — nothing to do.");
    process.exit(0);
  }

  console.log(`Found ${noPassword.length} user(s) without a password. Setting default "password"…`);

  for (const user of noPassword) {
    const resetToken = randomBytes(32).toString("hex");
    const resetExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await db
      .update(usersTable)
      .set({
        passwordHash: hash,
        mustChangePassword: true,
        passwordResetToken: resetToken,
        passwordResetTokenExpiry: resetExpiry,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    console.log(`  ✓ ${user.username} — default password set, mustChangePassword = true`);
  }

  console.log("\nDone. Users can now log in at /user-signin with username + password \"password\".");
  console.log("They will be prompted to set a new password immediately after.");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
