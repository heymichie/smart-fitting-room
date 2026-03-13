import { pgTable, serial, boolean, timestamp } from "drizzle-orm/pg-core";

export const rightsSettingsTable = pgTable("rights_settings", {
  id:                            serial("id").primaryKey(),
  smRespondAlert:                boolean("sm_respond_alert").notNull().default(true),
  smOpenDoor:                    boolean("sm_open_door").notNull().default(true),
  smClearEntrance:               boolean("sm_clear_entrance").notNull().default(true),
  smSpoolReports:                boolean("sm_spool_reports").notNull().default(true),
  ssRespondAlert:                boolean("ss_respond_alert").notNull().default(true),
  ssOpenDoor:                    boolean("ss_open_door").notNull().default(true),
  ssClearEntrance:               boolean("ss_clear_entrance").notNull().default(true),
  ssSpoolReports:                boolean("ss_spool_reports").notNull().default(true),
  adminCreateAccounts:           boolean("admin_create_accounts").notNull().default(true),
  adminSetupFittingRooms:        boolean("admin_setup_fitting_rooms").notNull().default(true),
  adminSpoolReports:             boolean("admin_spool_reports").notNull().default(true),
  updatedAt:                     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type RightsSettings = typeof rightsSettingsTable.$inferSelect;
