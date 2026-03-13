import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const fittingRoomsTable = pgTable("fitting_rooms", {
  id:             serial("id").primaryKey(),
  roomId:         text("room_id").notNull().unique(),
  branchCode:     text("branch_code").notNull(),
  name:           text("name").notNull(),
  location:       text("location").notNull().default(""),
  status:         text("status", { enum: ["available", "occupied", "alert"] }).notNull().default("available"),
  occupiedSince:  timestamp("occupied_since",   { withTimezone: true }),
  alertSince:     timestamp("alert_since",      { withTimezone: true }),
  lastOccupiedAt: timestamp("last_occupied_at", { withTimezone: true }),
  garmentCount:   integer("garment_count"),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type FittingRoom = typeof fittingRoomsTable.$inferSelect;
