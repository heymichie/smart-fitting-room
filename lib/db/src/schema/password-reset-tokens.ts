import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id:        serial("id").primaryKey(),
  userId:    serial("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  token:     text("token").notNull().unique(),
  used:      boolean("used").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;
