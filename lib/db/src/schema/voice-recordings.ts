import { pgTable, serial, text, timestamp, integer, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const voiceRecordingsTable = pgTable("voice_recordings", {
  id:             serial("id").primaryKey(),
  branchCode:     varchar("branch_code", { length: 50 }).notNull(),
  fittingRoomId:  integer("fitting_room_id"),
  fittingRoomName:text("fitting_room_name"),
  alertTime:      timestamp("alert_time").notNull().defaultNow(),
  durationSec:    integer("duration_sec"),
  source:         varchar("source", { length: 30 }).notNull().default("fitting_room"),
  audioObjectPath:text("audio_object_path"),
  transcript:     text("transcript"),
  transcribedAt:  timestamp("transcribed_at"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
});

export const insertVoiceRecordingSchema = createInsertSchema(voiceRecordingsTable).omit({ id: true, createdAt: true });
export type InsertVoiceRecording = z.infer<typeof insertVoiceRecordingSchema>;
export type VoiceRecording = typeof voiceRecordingsTable.$inferSelect;
