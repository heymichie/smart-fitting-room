import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adminTable = pgTable("admin", {
  id: serial("id").primaryKey(),
  organisationalId: text("organisational_id").notNull().unique(),
  organisationTradingName: text("organisation_trading_name").notNull(),
  administratorForenames: text("administrator_forenames").notNull(),
  surname: text("surname").notNull(),
  designation: text("designation").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  productCode: text("product_code").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdminSchema = createInsertSchema(adminTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof adminTable.$inferSelect;
