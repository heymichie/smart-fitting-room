import { useEffect, useRef, useState } from "react";

interface AlertModalProps {
  roomName: string;
  onIgnore: () => void;
}

const BAR_COUNT = 24;

function SpeakerIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 shrink-0" stroke={active ? "#1e3a6e" : "#374151"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={active ? "#1e3a6e" : "#374151"} stroke="none" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 shrink-0" stroke="#374151" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function AlertModal({ roomName, onIgnore }: AlertModalProps) {
  const [responding, setResponding] = useState(false);
  const [bars, setBars] = useState<number[]>(new Array(BAR_COUNT).fill(0.08));

  const streamRef   = useRef<MediaStream | null>(null);
  const animRef     = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ctxRef      = useRef<AudioContext | null>(null);

  const stopMic = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (ctxRef.current) ctxRef.current.close();
    analyserRef.current = null;
    ctxRef.current      = null;
    streamRef.current   = null;
    setBars(new Array(BAR_COUNT).fill(0.08));
  };

  const handleRespond = async () => {
    if (responding) {
      stopMic();
      setResponding(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx      = new AudioContext();
      ctxRef.current = ctx;
      const source   = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyserRef.current = analyser;

      setResponding(true);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const animate = () => {
        analyser.getByteFrequencyData(dataArray);
        const newBars = Array.from({ length: BAR_COUNT }, (_, i) => {
          const idx = Math.floor((i / BAR_COUNT) * dataArray.length);
          return dataArray[idx] / 255;
        });
        setBars(newBars);
        animRef.current = requestAnimationFrame(animate);
      };

      animate();
    } catch {
      alert("Microphone access is required to respond. Please allow microphone access and try again.");
    }
  };

  useEffect(() => () => stopMic(), []);

  const handleIgnore = () => {
    stopMic();
    onIgnore();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
    >
      <div
        className="rounded-3xl flex flex-col items-center py-10 px-10 gap-5 text-center"
        style={{ backgroundColor: "#2e5096", width: "400px", maxWidth: "92vw" }}
      >
        {/* Title */}
        <h1
          className="text-white font-extrabold uppercase leading-tight tracking-wide"
          style={{
            fontSize: "clamp(2.4rem, 8vw, 3.2rem)",
            textShadow: "1px 1px 0 rgba(255,255,255,0.15), 2px 4px 8px rgba(0,0,0,0.45)",
          }}
        >
          FITTING ROOM ALERT!
        </h1>

        {/* Location */}
        <p className="text-white/90 text-lg font-medium">
          Location: {roomName}
        </p>

        {/* Wave visualizer */}
        <div className="flex items-end justify-center gap-[3px] w-full" style={{ height: "64px" }}>
          {bars.map((h, i) => {
            const height = Math.max(6, h * 60);
            const opacity = responding ? 0.5 + h * 0.5 : 0.25;
            return (
              <div
                key={i}
                className="rounded-full"
                style={{
                  width: "9px",
                  height: `${height}px`,
                  backgroundColor: responding
                    ? `rgba(140, 190, 255, ${opacity})`
                    : "rgba(255,255,255,0.25)",
                  transition: responding ? "height 60ms ease-out" : "height 300ms ease",
                  alignSelf: "flex-end",
                }}
              />
            );
          })}
        </div>

        {/* Buttons */}
        <div className="flex gap-4 w-full mt-1">
          <button
            onClick={handleRespond}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-semibold transition hover:brightness-95 active:brightness-90"
            style={{
              backgroundColor: responding ? "#a8c4f0" : "#c8d4ec",
              color: "#1a2e58",
            }}
          >
            <SpeakerIcon active={responding} />
            {responding ? "Speaking…" : "Respond"}
          </button>

          <button
            onClick={handleIgnore}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-semibold transition hover:brightness-95 active:brightness-90"
            style={{ backgroundColor: "#c8d4ec", color: "#1a2e58" }}
          >
            <XIcon />
            Ignore
          </button>
        </div>
      </div>
    </div>
  );
}
