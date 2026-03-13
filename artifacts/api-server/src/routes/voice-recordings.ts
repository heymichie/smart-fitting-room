import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import OpenAI from "openai";
import { toFile } from "openai";
import { db } from "@workspace/db";
import { voiceRecordingsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";

const router = Router();

// Multer: keep audio files in memory (max 50 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["audio/webm", "audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/m4a", "application/octet-stream"];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith("audio/")) cb(null, true);
    else cb(new Error("Only audio files are accepted"));
  },
});

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey:  process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

function getBucket() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return objectStorageClient.bucket(bucketId);
}

async function uploadAudioToGCS(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const bucket     = getBucket();
  const objectName = `voice-recordings/${randomUUID()}/${filename}`;
  const file       = bucket.file(objectName);
  await file.save(buffer, { contentType: mimeType, resumable: false });
  return `/voice-recordings/${objectName}`;
}

// POST /api/voice-recordings/upload
// IoT devices / mobile apps POST an audio file after an alert
router.post("/voice-recordings/upload", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No audio file provided" });
    return;
  }

  const { branchCode, fittingRoomId, fittingRoomName, alertTime, durationSec, source } = req.body;

  if (!branchCode) {
    res.status(400).json({ error: "branchCode is required" });
    return;
  }

  try {
    const ext            = req.file.originalname.split(".").pop() || "webm";
    const filename       = `alert_${Date.now()}.${ext}`;
    const audioObjectPath = await uploadAudioToGCS(req.file.buffer, req.file.mimetype, filename);

    const [recording] = await db.insert(voiceRecordingsTable).values({
      branchCode,
      fittingRoomId:   fittingRoomId   ? parseInt(fittingRoomId)   : null,
      fittingRoomName: fittingRoomName ?? null,
      alertTime:       alertTime        ? new Date(alertTime)        : new Date(),
      durationSec:     durationSec      ? parseInt(durationSec)      : null,
      source:          source           ?? "fitting_room",
      audioObjectPath,
    }).returning();

    res.status(201).json(recording);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to store recording" });
  }
});

// GET /api/voice-recordings?branchCode=X
router.get("/voice-recordings", async (req, res) => {
  const { branchCode } = req.query as Record<string, string>;
  try {
    const conditions = [];
    if (branchCode && branchCode !== "ALL") {
      conditions.push(eq(voiceRecordingsTable.branchCode, branchCode));
    }
    const recordings = await db
      .select()
      .from(voiceRecordingsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(voiceRecordingsTable.alertTime));
    res.json(recordings);
  } catch (err) {
    console.error("List error:", err);
    res.status(500).json({ error: "Failed to list recordings" });
  }
});

// GET /api/voice-recordings/:id/download
// Streams the audio file from GCS to the client
router.get("/voice-recordings/:id/download", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [recording] = await db
      .select()
      .from(voiceRecordingsTable)
      .where(eq(voiceRecordingsTable.id, id));

    if (!recording || !recording.audioObjectPath) {
      res.status(404).json({ error: "Recording not found" });
      return;
    }

    // audioObjectPath is stored as "/voice-recordings/<bucketId>/voice-recordings/<uuid>/<filename>"
    // We just need the GCS object name (everything after the first "/voice-recordings/<bucketId>/")
    const path       = recording.audioObjectPath; // e.g. /voice-recordings/gs-path
    const bucket     = getBucket();
    // Strip leading /voice-recordings/ prefix and bucket name if present
    let objectName   = path.replace(/^\/voice-recordings\//, "");
    // If it still starts with the bucket ID, strip it
    const bucketId   = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";
    if (objectName.startsWith(bucketId + "/")) objectName = objectName.slice(bucketId.length + 1);

    const file       = bucket.file(objectName);
    const [exists]   = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Audio file not found in storage" });
      return;
    }

    const [metadata] = await file.getMetadata();
    const ext        = objectName.split(".").pop() || "webm";
    res.setHeader("Content-Type",        (metadata.contentType as string) || "audio/webm");
    res.setHeader("Content-Disposition", `attachment; filename="recording_${id}.${ext}"`);
    if (metadata.size) res.setHeader("Content-Length", String(metadata.size));

    file.createReadStream().pipe(res);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Failed to download recording" });
  }
});

// POST /api/voice-recordings/:id/transcribe
// Fetches the audio file from GCS and sends it to OpenAI Whisper
router.post("/voice-recordings/:id/transcribe", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [recording] = await db
      .select()
      .from(voiceRecordingsTable)
      .where(eq(voiceRecordingsTable.id, id));

    if (!recording) {
      res.status(404).json({ error: "Recording not found" });
      return;
    }

    if (recording.transcript) {
      res.json({ transcript: recording.transcript, cached: true });
      return;
    }

    if (!recording.audioObjectPath) {
      res.status(400).json({ error: "No audio file attached to this recording" });
      return;
    }

    // Fetch audio buffer from GCS
    const bucket   = getBucket();
    let objectName = recording.audioObjectPath.replace(/^\/voice-recordings\//, "");
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";
    if (objectName.startsWith(bucketId + "/")) objectName = objectName.slice(bucketId.length + 1);

    const file      = bucket.file(objectName);
    const [exists]  = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Audio file not found in storage" });
      return;
    }

    const [audioBuffer] = await file.download();
    const ext            = objectName.split(".").pop() || "webm";
    const mimeMap: Record<string, string> = { wav: "audio/wav", mp3: "audio/mpeg", mp4: "audio/mp4", m4a: "audio/mp4", ogg: "audio/ogg", webm: "audio/webm" };
    const mimeType       = mimeMap[ext] || "audio/webm";

    const audioFile = await toFile(audioBuffer, `recording.${ext}`, { type: mimeType });

    const result = await openai.audio.transcriptions.create({
      model: "gpt-4o-mini-transcribe",
      file:   audioFile,
      response_format: "json",
    });

    const transcript = result.text;

    await db.update(voiceRecordingsTable)
      .set({ transcript, transcribedAt: new Date() })
      .where(eq(voiceRecordingsTable.id, id));

    res.json({ transcript, cached: false });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: "Failed to transcribe recording" });
  }
});

// DELETE /api/voice-recordings/:id
router.delete("/voice-recordings/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [recording] = await db
      .select()
      .from(voiceRecordingsTable)
      .where(eq(voiceRecordingsTable.id, id));

    if (!recording) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (recording.audioObjectPath) {
      try {
        const bucket   = getBucket();
        let objectName = recording.audioObjectPath.replace(/^\/voice-recordings\//, "");
        const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";
        if (objectName.startsWith(bucketId + "/")) objectName = objectName.slice(bucketId.length + 1);
        await bucket.file(objectName).delete({ ignoreNotFound: true });
      } catch (_) {}
    }

    await db.delete(voiceRecordingsTable).where(eq(voiceRecordingsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete recording" });
  }
});

export default router;
