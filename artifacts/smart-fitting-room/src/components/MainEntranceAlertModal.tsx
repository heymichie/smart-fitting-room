import { useEffect, useRef, useState, useCallback } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/[^/]*$/, "") + "/api";

export interface EntranceAlertPayload {
  sessionId:    number;
  branchCode:   string;
  customerId:   string | null;
  alertTime:    string;
  entryCodes:   string[];
  exitCodes:    string[];
  entryCount:   number | null;
  exitCount:    number | null;
  quantityOk:   boolean;
  codesOk:      boolean;
  cctvClipUrl:  string | null;
}

interface Props {
  alert:    EntranceAlertPayload;
  onClose:  () => void;
}

function playBeep() {
  try {
    const ctx  = new AudioContext();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
    // Second beep
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = "square";
    osc2.frequency.value = 660;
    gain2.gain.setValueAtTime(0.6, ctx.currentTime + 1.0);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
    osc2.start(ctx.currentTime + 1.0);
    osc2.stop(ctx.currentTime + 1.8);
  } catch { /* audio not available */ }
}

export default function MainEntranceAlertModal({ alert, onClose }: Props) {
  const [showInfo, setShowInfo]   = useState(false);
  const [resolving, setResolving] = useState(false);
  const beepedRef = useRef(false);

  useEffect(() => {
    if (!beepedRef.current) {
      playBeep();
      beepedRef.current = true;
    }
  }, []);

  const handleResolve = useCallback(async () => {
    setResolving(true);
    try {
      await fetch(`${API_BASE}/fitting-rooms/entrance/resolve`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId: alert.sessionId }),
      });
    } catch { /* ignore */ }
    setResolving(false);
    onClose();
  }, [alert.sessionId, onClose]);

  const missingCodes = alert.entryCodes.filter(c => {
    const exit = [...alert.exitCodes];
    const idx = exit.indexOf(c);
    if (idx !== -1) { exit.splice(idx, 1); return false; }
    return true;
  });
  const extraCodes = alert.exitCodes.filter(c => {
    const entry = [...alert.entryCodes];
    const idx = entry.indexOf(c);
    if (idx !== -1) { entry.splice(idx, 1); return false; }
    return true;
  });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="flex flex-col items-center justify-center rounded-2xl overflow-hidden"
        style={{ backgroundColor: "#dd0000", width: 420, maxWidth: "95vw", minHeight: 440, padding: "48px 32px 36px" }}>

        {/* Title */}
        <h1
          className="font-extrabold text-center leading-none uppercase"
          style={{
            color: "white",
            fontSize: "clamp(2.4rem, 9vw, 3.4rem)",
            textShadow: "2px 2px 0 rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.4)",
            letterSpacing: "0.01em",
            marginBottom: 28,
          }}
        >
          Main Fitting<br />Room Entrance<br />ALERT!
        </h1>

        {/* View customer information toggle */}
        <button
          onClick={() => setShowInfo(v => !v)}
          style={{ color: "rgba(255,255,255,0.9)", fontStyle: "italic", fontSize: "1.05rem", marginBottom: 28, textDecoration: "underline" }}
        >
          View Customer Information
        </button>

        {/* Customer info panel */}
        {showInfo && (
          <div className="w-full rounded-xl mb-6 p-4 text-sm"
            style={{ backgroundColor: "rgba(0,0,0,0.30)", color: "white" }}>
            {alert.customerId && (
              <p className="mb-2"><span className="opacity-70">Customer ID:</span> <strong>{alert.customerId}</strong></p>
            )}
            <p className="mb-1 opacity-70 font-semibold uppercase text-xs tracking-wider">Alert: {alert.alertTime}</p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="opacity-60 text-xs mb-1">Checked In ({alert.entryCount ?? alert.entryCodes.length} items)</p>
                {alert.entryCodes.length
                  ? alert.entryCodes.map((c, i) => (
                      <p key={i} className="font-mono text-xs leading-5"
                        style={{ color: missingCodes.includes(c) ? "#ffcccc" : "white" }}>{c}</p>
                    ))
                  : <p className="opacity-50 text-xs">—</p>}
              </div>
              <div>
                <p className="opacity-60 text-xs mb-1">Checked Out ({alert.exitCount ?? alert.exitCodes.length} items)</p>
                {alert.exitCodes.length
                  ? alert.exitCodes.map((c, i) => (
                      <p key={i} className="font-mono text-xs leading-5"
                        style={{ color: extraCodes.includes(c) ? "#ffcccc" : "white" }}>{c}</p>
                    ))
                  : <p className="opacity-50 text-xs">—</p>}
              </div>
            </div>

            {missingCodes.length > 0 && (
              <p className="mt-3 text-xs font-semibold" style={{ color: "#ffdddd" }}>
                ⚠ Missing: {missingCodes.join(", ")}
              </p>
            )}

            {/* CCTV clip */}
            {alert.cctvClipUrl ? (
              <div className="mt-4">
                <p className="opacity-60 text-xs mb-1 uppercase tracking-wider">CCTV Footage</p>
                <video
                  src={alert.cctvClipUrl}
                  controls
                  className="w-full rounded-lg"
                  style={{ maxHeight: 180 }}
                />
              </div>
            ) : (
              <p className="mt-4 text-xs opacity-50 italic">
                CCTV clip: will appear here once the recording system delivers it.
              </p>
            )}
          </div>
        )}

        {/* Resolved button */}
        <button
          onClick={handleResolve}
          disabled={resolving}
          style={{
            backgroundColor: "white",
            color: "#1a1a1a",
            fontWeight: 700,
            fontSize: "1.1rem",
            borderRadius: 14,
            padding: "14px 48px",
            cursor: resolving ? "not-allowed" : "pointer",
            opacity: resolving ? 0.7 : 1,
          }}
        >
          {resolving ? "Resolving…" : "Resolved"}
        </button>
      </div>
    </div>
  );
}
