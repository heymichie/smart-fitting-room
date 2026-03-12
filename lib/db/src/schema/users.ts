import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  username: text("username").notNull().unique(),
  forenames: text("forenames").notNull(),
  surname: text("surname").notNull(),
  employeeNumber: text("employee_number").notNull(),
  rights: text("rights", { enum: ["store_manager", "store_supervisor", "administrator"] }).notNull(),
  storeBranchCode: text("store_branch_code").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserRecord = typeof usersTable.$inferSelect;
