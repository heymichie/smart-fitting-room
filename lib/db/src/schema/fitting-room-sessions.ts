import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const fittingRoomSessionsTable = pgTable("fitting_room_sessions", {
  id:                      serial("id").primaryKey(),
  branchCode:              text("branch_code").notNull(),

  mainEntranceEntryTime:   text("main_entrance_entry_time"),
  customerId:              text("customer_id"),
  garmentCount:            integer("garment_count"),
  productCodesIn:          text("product_codes_in"),

  fittingRoomName:         text("fitting_room_name"),
  fittingRoomEntryTime:    text("fitting_room_entry_time"),
  fittingRoomExitTime:     text("fitting_room_exit_time"),
  durationMinutes:         integer("duration_minutes"),

  alertTime:               text("alert_time"),
  alertAttendantId:        text("alert_attendant_id"),

  mainEntranceExitTime:    text("main_entrance_exit_time"),
  mainEntranceAlertTime:   text("main_entrance_alert_time"),
  productCodesOut:         text("product_codes_out"),
  exitGarmentCount:        integer("exit_garment_count"),
  checkoutAttendantId:     text("checkout_attendant_id"),

  hasAlert:                boolean("has_alert").notNull().default(false),
  isActive:                boolean("is_active").notNull().default(true),

  createdAt:               timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:               timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type FittingRoomSession = typeof fittingRoomSessionsTable.$inferSelect;
