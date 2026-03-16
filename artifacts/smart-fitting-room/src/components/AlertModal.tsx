import { useEffect, useRef, useState, useCallback } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/[^/]*$/, "") + "/api";
const BAR_COUNT = 24;
const STUN = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

interface AlertModalProps {
  roomId:     string;
  roomName:   string;
  branchCode: string;
  roomDbId:   number;
  onIgnore:   () => void;
}

type CallState = "idle" | "connecting" | "active" | "ended";

function SpeakerIcon({ active }: { active: boolean }) {
  const c = active ? "#1e3a6e" : "#374151";
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 shrink-0" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={c} stroke="none" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 shrink-0" stroke="#374151" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 shrink-0" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.08 4.18 2 2 0 015 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L9.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function WaveViz({ bars, active, color }: { bars: number[]; active: boolean; color: string }) {
  return (
    <div className="flex items-end justify-center gap-[3px] w-full" style={{ height: "48px" }}>
      {bars.map((h, i) => (
        <div key={i} className="rounded-full" style={{
          width: "7px",
          height: `${Math.max(4, h * 44)}px`,
          backgroundColor: color,
          opacity: active ? (0.4 + h * 0.6) : 0.22,
          transition: active ? "height 60ms ease-out" : "height 400ms ease",
          alignSelf: "flex-end",
        }} />
      ))}
    </div>
  );
}

function useAnalyser(stream: MediaStream | null): number[] {
  const [bars, setBars]             = useState<number[]>(new Array(BAR_COUNT).fill(0.06));
  const [trackCount, setTrackCount] = useState(0);
  const animRef = useRef<number | null>(null);
  const ctxRef  = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream) { setTrackCount(0); return; }
    const onAdd = () => setTrackCount(c => c + 1);
    stream.addEventListener("addtrack", onAdd as EventListener);
    setTrackCount(stream.getAudioTracks().length);
    return () => stream.removeEventListener("addtrack", onAdd as EventListener);
  }, [stream]);

  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (ctxRef.current) { ctxRef.current.close(); ctxRef.current = null; }

    if (!stream || stream.getAudioTracks().length === 0) {
      setBars(new Array(BAR_COUNT).fill(0.06));
      return;
    }
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const ana = ctx.createAnalyser();
    ana.fftSize = 128;
    ana.smoothingTimeConstant = 0.78;
    src.connect(ana);
    const data = new Uint8Array(ana.frequencyBinCount);
    const tick = () => {
      ana.getByteFrequencyData(data);
      setBars(Array.from({ length: BAR_COUNT }, (_, i) => data[Math.floor((i / BAR_COUNT) * data.length)] / 255));
      animRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (ctx.state !== "closed") ctx.close().catch(() => {});
    };
  }, [stream, trackCount]);

  return bars;
}

export default function AlertModal({ roomId, roomName, branchCode, roomDbId, onIgnore }: AlertModalProps) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");

  const pcRef            = useRef<RTCPeerConnection | null>(null);
  const sseRef           = useRef<EventSource | null>(null);
  const audioRef         = useRef<HTMLAudioElement | null>(null);
  const mediaRecRef      = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const callStartRef     = useRef<Date | null>(null);
  const alertTimeRef     = useRef<string>(new Date().toISOString());
  const mixCtxRef        = useRef<AudioContext | null>(null);

  const localBars  = useAnalyser(localStream);
  const remoteBars = useAnalyser(remoteStream);

  const stopRecording = useCallback(() => {
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
      mediaRecRef.current.stop();
    }
  }, []);

  const uploadRecording = useCallback(async (blob: Blob, durationSec: number) => {
    try {
      setUploadStatus("uploading");
      const form = new FormData();
      form.append("audio",           blob, `call_${roomId}_${Date.now()}.webm`);
      form.append("branchCode",      branchCode);
      form.append("fittingRoomId",   String(roomDbId));
      form.append("fittingRoomName", roomName);
      form.append("alertTime",       alertTimeRef.current);
      form.append("durationSec",     String(Math.round(durationSec)));
      form.append("source",          "supervisor-call");

      const res = await fetch(`${API_BASE}/voice-recordings/upload`, { method: "POST", body: form });
      setUploadStatus(res.ok ? "done" : "error");
    } catch {
      setUploadStatus("error");
    }
  }, [roomId, roomName, branchCode, roomDbId]);

  const startRecording = useCallback((local: MediaStream, remote: MediaStream) => {
    try {
      const ctx  = new AudioContext();
      mixCtxRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();

      const connectStream = (s: MediaStream) => {
        if (s.getAudioTracks().length > 0) {
          ctx.createMediaStreamSource(s).connect(dest);
        } else {
          s.addEventListener("addtrack", () => {
            if (s.getAudioTracks().length > 0) {
              ctx.createMediaStreamSource(s).connect(dest);
            }
          });
        }
      };

      connectStream(local);
      connectStream(remote);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const rec = new MediaRecorder(dest.stream, { mimeType });
      mediaRecRef.current = rec;
      chunksRef.current   = [];
      callStartRef.current = new Date();

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const durationSec = callStartRef.current
          ? (Date.now() - callStartRef.current.getTime()) / 1000
          : 0;
        if (blob.size > 0) uploadRecording(blob, durationSec);
        if (mixCtxRef.current) { mixCtxRef.current.close(); mixCtxRef.current = null; }
      };

      rec.start(1000);
    } catch (err) {
      console.warn("Recording not available:", err);
    }
  }, [uploadRecording]);

  const cleanup = useCallback(() => {
    sseRef.current?.close();
    pcRef.current?.close();
    localStream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    if (audioRef.current) { audioRef.current.srcObject = null; }
    pcRef.current  = null;
    sseRef.current = null;
  }, [localStream]);

  const endCall = useCallback(async () => {
    stopRecording();
    try { await fetch(`${API_BASE}/voice-call/end/${encodeURIComponent(roomId)}`, { method: "POST" }); } catch {}
    cleanup();
    setCallState("idle");
  }, [roomId, cleanup, stopRecording]);

  const startCall = async () => {
    alertTimeRef.current = new Date().toISOString();
    setCallState("connecting");
    setUploadStatus("idle");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(stream);

      const pc = new RTCPeerConnection(STUN);
      pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const remoteMS = new MediaStream();
      setRemoteStream(remoteMS);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.srcObject = remoteMS;
      audioRef.current.play().catch(() => {});

      pc.ontrack = (e) => { e.streams[0]?.getTracks().forEach(t => remoteMS.addTrack(t)); };

      pc.onicecandidate = async (e) => {
        if (e.candidate) {
          await fetch(`${API_BASE}/voice-call/ice/${encodeURIComponent(roomId)}/supervisor`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(e.candidate),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setCallState("active");
          startRecording(stream, remoteMS);
        }
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") endCall();
      };

      const sse = new EventSource(`${API_BASE}/voice-call/events/${encodeURIComponent(roomId)}/supervisor`);
      sseRef.current = sse;

      sse.addEventListener("answer", async (e) => {
        const answer = JSON.parse((e as MessageEvent).data);
        if (pc.signalingState !== "stable") await pc.setRemoteDescription(answer);
        setCallState("active");
        startRecording(stream, remoteMS);
      });

      sse.addEventListener("ice", async (e) => {
        try { await pc.addIceCandidate(JSON.parse((e as MessageEvent).data)); } catch {}
      });

      sse.addEventListener("end", () => { stopRecording(); cleanup(); setCallState("ended"); });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await fetch(`${API_BASE}/voice-call/offer/${encodeURIComponent(roomId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(offer),
      });

    } catch (err) {
      console.error(err);
      cleanup();
      setCallState("idle");
      alert("Microphone access is required. Please allow microphone and try again.");
    }
  };

  const handleIgnore = () => { cleanup(); onIgnore(); };

  useEffect(() => () => { stopRecording(); cleanup(); }, []);

  const isLive       = callState === "active";
  const isConnecting = callState === "connecting";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.68)" }}>
      <div className="rounded-3xl flex flex-col items-center py-10 px-10 gap-4 text-center"
        style={{ backgroundColor: "#2e5096", width: "420px", maxWidth: "93vw" }}>

        <h1 className="text-white font-extrabold uppercase leading-tight tracking-wide"
          style={{ fontSize: "clamp(2.2rem, 7vw, 3rem)", textShadow: "1px 1px 0 rgba(255,255,255,0.15), 2px 4px 8px rgba(0,0,0,0.45)" }}>
          FITTING ROOM ALERT!
        </h1>

        <p className="text-white/90 text-lg font-medium">Location: {roomName}</p>

        {callState !== "idle" && (
          <p className="text-white/70 text-sm tracking-wide">
            {isConnecting && "Calling fitting room…"}
            {isLive && "● Live call in progress"}
            {callState === "ended" && "Call ended"}
          </p>
        )}

        {uploadStatus === "uploading" && (
          <p className="text-white/50 text-xs">Saving call recording…</p>
        )}
        {uploadStatus === "done" && (
          <p className="text-white/50 text-xs">Call recording saved to reports.</p>
        )}

        <div className="w-full space-y-2 mt-1">
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-xs w-16 text-right shrink-0">You</span>
            <WaveViz bars={localBars} active={isLive || isConnecting} color="rgba(160,200,255,1)" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-xs w-16 text-right shrink-0">Customer</span>
            <WaveViz bars={remoteBars} active={isLive} color="rgba(180,240,180,1)" />
          </div>
        </div>

        <div className="flex gap-4 w-full mt-2">
          {callState === "idle" || callState === "ended" ? (
            <button onClick={startCall}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-semibold transition hover:brightness-95 active:brightness-90"
              style={{ backgroundColor: "#c8d4ec", color: "#1a2e58" }}>
              <SpeakerIcon active={false} />
              Respond
            </button>
          ) : (
            <button onClick={endCall}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-semibold transition hover:brightness-90"
              style={{ backgroundColor: isLive ? "#e07070" : "#c8d4ec", color: isLive ? "white" : "#1a2e58" }}>
              <PhoneIcon />
              {isConnecting ? "Connecting…" : "End Call"}
            </button>
          )}

          <button onClick={handleIgnore}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-semibold transition hover:brightness-95 active:brightness-90"
            style={{ backgroundColor: "#c8d4ec", color: "#1a2e58" }}>
            <XIcon />
            Ignore
          </button>
        </div>

        {(callState === "idle" || callState === "ended") && (
          <p className="text-white/40 text-xs mt-1">
            Fitting room device: open <span className="font-mono">/fitting-room-panel?roomId={roomId}</span>
          </p>
        )}
      </div>
    </div>
  );
}
