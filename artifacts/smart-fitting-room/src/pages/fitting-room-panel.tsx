import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useSearch } from "wouter";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/[^/]*$/, "") + "/api";
const BAR_COUNT = 24;
const STUN = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

type CallState = "waiting" | "incoming" | "active" | "ended";

const HangerIcon = () => (
  <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12">
    <path d="M36 9C32.134 9 29 12.134 29 16C29 19.076 30.981 21.685 33.749 22.643C34.065 23.131 34.463 23.683 34.966 24.344C29.244 26.685 9 35.5 9 46H63C63 35.5 42.756 26.685 37.034 24.344C37.537 23.683 37.935 23.131 38.251 22.643C41.019 21.685 43 19.076 43 16C43 12.134 39.866 9 36 9Z"
      stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="30" y="15" width="12" height="8" rx="1.5" fill="white" opacity="0.95" />
    <line x1="16" y1="46" x2="16" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="56" y1="46" x2="56" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

function PhoneAcceptIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.08 4.18 2 2 0 015 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L9.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function PhoneEndIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.08 4.18 2 2 0 015 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L9.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function WaveViz({ bars, active, color }: { bars: number[]; active: boolean; color: string }) {
  return (
    <div className="flex items-end justify-center gap-[3px] w-full" style={{ height: "52px" }}>
      {bars.map((h, i) => (
        <div key={i} className="rounded-full" style={{
          width: "8px",
          height: `${Math.max(4, h * 48)}px`,
          backgroundColor: color,
          opacity: active ? (0.4 + h * 0.6) : 0.2,
          transition: active ? "height 60ms ease-out" : "height 400ms ease",
          alignSelf: "flex-end",
        }} />
      ))}
    </div>
  );
}

function useAnalyser(stream: MediaStream | null): number[] {
  const [bars, setBars] = useState<number[]>(new Array(BAR_COUNT).fill(0.06));
  const animRef = useRef<number | null>(null);
  const ctxRef  = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (ctxRef.current) { ctxRef.current.close(); ctxRef.current = null; }
      setBars(new Array(BAR_COUNT).fill(0.06));
      return;
    }
    const ctx  = new AudioContext();
    ctxRef.current = ctx;
    const src  = ctx.createMediaStreamSource(stream);
    const ana  = ctx.createAnalyser();
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
      ctx.close();
    };
  }, [stream]);
  return bars;
}

export default function FittingRoomPanel() {
  const [, setLocation]   = useLocation();
  const search            = useSearch();
  const params            = new URLSearchParams(search);
  const roomId            = params.get("roomId") ?? "";
  const roomName          = params.get("name")   ?? roomId;

  const [callState, setCallState]     = useState<CallState>("waiting");
  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [pendingOffer, setPendingOffer] = useState<RTCSessionDescriptionInit | null>(null);

  const pcRef    = useRef<RTCPeerConnection | null>(null);
  const sseRef   = useRef<EventSource | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const localBars  = useAnalyser(localStream);
  const remoteBars = useAnalyser(remoteStream);

  const cleanup = useCallback(() => {
    sseRef.current?.close();
    pcRef.current?.close();
    localStream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    if (audioRef.current) audioRef.current.srcObject = null;
    pcRef.current  = null;
    sseRef.current = null;
    setPendingOffer(null);
  }, [localStream]);

  useEffect(() => {
    if (!roomId) return;

    const sse = new EventSource(`${API_BASE}/voice-call/events/${encodeURIComponent(roomId)}/room`);
    sseRef.current = sse;

    sse.addEventListener("offer", (e) => {
      setPendingOffer(JSON.parse((e as MessageEvent).data));
      setCallState("incoming");
    });

    sse.addEventListener("ice", async (e) => {
      if (pcRef.current) {
        try { await pcRef.current.addIceCandidate(JSON.parse((e as MessageEvent).data)); } catch {}
      }
    });

    sse.addEventListener("end", () => {
      cleanup();
      setCallState("ended");
    });

    return () => { sse.close(); };
  }, [roomId]);

  const acceptCall = async () => {
    if (!pendingOffer) return;
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
          await fetch(`${API_BASE}/voice-call/ice/${encodeURIComponent(roomId)}/room`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(e.candidate),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setCallState("active");
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          cleanup(); setCallState("ended");
        }
      };

      await pc.setRemoteDescription(pendingOffer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await fetch(`${API_BASE}/voice-call/answer/${encodeURIComponent(roomId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answer),
      });

      setPendingOffer(null);
      setCallState("active");
    } catch (err) {
      console.error(err);
      cleanup();
      setCallState("waiting");
      alert("Microphone access is required to accept the call.");
    }
  };

  const endCall = async () => {
    try { await fetch(`${API_BASE}/voice-call/end/${encodeURIComponent(roomId)}`, { method: "POST" }); } catch {}
    cleanup();
    setCallState("ended");
  };

  const isLive     = callState === "active";
  const isIncoming = callState === "incoming";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: "#1e3a6e" }}>

      {/* Header branding */}
      <div className="absolute top-6 left-6 flex items-center gap-3">
        <button onClick={() => setLocation("/user-signin")} className="hover:opacity-80 transition" aria-label="Home">
          <HangerIcon />
        </button>
        <span className="text-white text-base font-medium tracking-wide">Smart Fitting Room</span>
      </div>

      {/* Main card */}
      <div className="rounded-3xl flex flex-col items-center py-10 px-10 gap-5 text-center w-full"
        style={{ backgroundColor: "#2e5096", maxWidth: "420px" }}>

        {/* Room title */}
        <h1 className="text-white font-extrabold uppercase leading-tight tracking-wide"
          style={{ fontSize: "clamp(1.8rem, 6vw, 2.4rem)", textShadow: "1px 1px 0 rgba(255,255,255,0.12), 2px 4px 8px rgba(0,0,0,0.4)" }}>
          {roomName || "Fitting Room"}
        </h1>

        {/* Status */}
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isLive ? "bg-green-400" : isIncoming ? "bg-yellow-400 animate-pulse" : "bg-white/30"}`} />
          <p className="text-white/80 text-base font-medium">
            {callState === "waiting" && "Waiting for store staff…"}
            {callState === "incoming" && "Incoming call from store staff"}
            {callState === "active"   && "Live call with store staff"}
            {callState === "ended"    && "Call ended"}
          </p>
        </div>

        {/* Wave visualisers — only shown during / after call */}
        {(isLive || callState === "ended") && (
          <div className="w-full space-y-2 mt-1">
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-xs w-14 text-right shrink-0">You</span>
              <WaveViz bars={localBars} active={isLive} color="rgba(180,240,180,1)" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-xs w-14 text-right shrink-0">Staff</span>
              <WaveViz bars={remoteBars} active={isLive} color="rgba(160,200,255,1)" />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-4 w-full mt-2">
          {isIncoming && (
            <button onClick={acceptCall}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-semibold transition hover:brightness-90"
              style={{ backgroundColor: "#27ae60" }}>
              <PhoneAcceptIcon />
              <span className="text-white">Accept</span>
            </button>
          )}

          {isLive && (
            <button onClick={endCall}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-semibold transition hover:brightness-90"
              style={{ backgroundColor: "#e07070" }}>
              <PhoneEndIcon />
              <span className="text-white">End Call</span>
            </button>
          )}

          {(isIncoming || isLive) && (
            <button onClick={() => { cleanup(); setCallState("waiting"); }}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-semibold transition hover:brightness-95"
              style={{ backgroundColor: "#c8d4ec", color: "#1a2e58" }}>
              Decline
            </button>
          )}

          {callState === "ended" && (
            <button onClick={() => setCallState("waiting")}
              className="flex-1 py-3 px-4 rounded-2xl font-semibold transition hover:brightness-95"
              style={{ backgroundColor: "#c8d4ec", color: "#1a2e58" }}>
              Ready for next call
            </button>
          )}
        </div>
      </div>

      <p className="text-white/30 text-xs mt-8">Room ID: {roomId}</p>
    </div>
  );
}
