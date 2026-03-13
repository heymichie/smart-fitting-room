import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const fittingRoomsTable = pgTable("fitting_rooms", {
  id:          serial("id").primaryKey(),
  roomId:      text("room_id").notNull().unique(),
  branchCode:  text("branch_code").notNull(),
  name:        text("name").notNull(),
  location:    text("location").notNull().default(""),
  status:      text("status", { enum: ["available", "occupied", "maintenance"] }).notNull().default("available"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type FittingRoom = typeof fittingRoomsTable.$inferSelect;
