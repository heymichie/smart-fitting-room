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
  alert:   EntranceAlertPayload;
  onClose: () => void;
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

const ChevronUp = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const ChevronDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export default function MainEntranceAlertModal({ alert, onClose }: Props) {
  const [resolving, setResolving]   = useState(false);
  const [showInfo, setShowInfo]     = useState(true);
  const beepedRef                   = useRef(false);
  const scrollRef                   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!beepedRef.current) { playBeep(); beepedRef.current = true; }
  }, []);

  const scrollBy = useCallback((dir: "up" | "down") => {
    scrollRef.current?.scrollBy({ top: dir === "down" ? 120 : -120, behavior: "smooth" });
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
    const pool = [...alert.exitCodes];
    const idx  = pool.indexOf(c);
    if (idx !== -1) { pool.splice(idx, 1); return false; }
    return true;
  });

  const fmtTime = (t: string) => {
    if (/^\d{3,4}$/.test(t)) {
      const s = t.padStart(4, "0");
      return `${s.slice(0, 2)}:${s.slice(2)}`;
    }
    return t;
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="flex rounded-2xl overflow-hidden shadow-2xl"
        style={{
          backgroundColor: "#dd0000",
          width: "min(92vw, 820px)",
          maxHeight: "90vh",
        }}
      >
        {/* ── LEFT: Title column ────────────────────────────────────────────── */}
        <div
          className="flex flex-col items-center justify-between py-10 px-8 shrink-0"
          style={{ width: 280, borderRight: "2px solid rgba(255,255,255,0.15)" }}
        >
          <h1
            className="font-extrabold text-center leading-none uppercase"
            style={{
              color: "white",
              fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
              textShadow: "2px 2px 0 rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.35)",
              letterSpacing: "0.01em",
            }}
          >
            Main<br />Fitting<br />Room<br />Entrance<br />ALERT!
          </h1>

          {/* Resolved button */}
          <button
            onClick={handleResolve}
            disabled={resolving}
            style={{
              backgroundColor: "white",
              color: "#1a1a1a",
              fontWeight: 700,
              fontSize: "1rem",
              borderRadius: 12,
              padding: "12px 32px",
              cursor: resolving ? "not-allowed" : "pointer",
              opacity: resolving ? 0.7 : 1,
              marginTop: 32,
            }}
          >
            {resolving ? "Resolving…" : "Resolved"}
          </button>
        </div>

        {/* ── RIGHT: Info + scroll controls ────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Toggle header */}
          <div
            className="flex items-center justify-between px-6 py-4 shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.15)" }}
          >
            <button
              onClick={() => setShowInfo(v => !v)}
              style={{
                color: "rgba(255,255,255,0.92)",
                fontStyle: "italic",
                fontSize: "1rem",
                textDecoration: "underline",
              }}
            >
              {showInfo ? "Hide" : "View"} Customer Information
            </button>

            {/* Scroll buttons */}
            {showInfo && (
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => scrollBy("up")}
                  className="flex items-center justify-center rounded-lg transition hover:bg-white/20 active:bg-white/30"
                  style={{ width: 36, height: 30, border: "1px solid rgba(255,255,255,0.3)" }}
                  aria-label="Scroll up"
                >
                  <ChevronUp />
                </button>
                <button
                  onClick={() => scrollBy("down")}
                  className="flex items-center justify-center rounded-lg transition hover:bg-white/20 active:bg-white/30"
                  style={{ width: 36, height: 30, border: "1px solid rgba(255,255,255,0.3)" }}
                  aria-label="Scroll down"
                >
                  <ChevronDown />
                </button>
              </div>
            )}
          </div>

          {/* Scrollable customer info */}
          {showInfo && (
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-6 py-5"
              style={{ color: "white", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.3) transparent" }}
            >
              {/* Customer ID + Alert time */}
              <div
                className="rounded-xl p-4 mb-4"
                style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
              >
                <p className="text-sm mb-1">
                  <span className="opacity-60">Customer ID: </span>
                  <strong className="font-mono">{alert.customerId ?? "—"}</strong>
                </p>
                <p className="text-sm font-semibold" style={{ color: "#ffcccc" }}>
                  ALERT: {fmtTime(alert.alertTime)}
                </p>
              </div>

              {/* Codes grid */}
              <div
                className="rounded-xl p-4 mb-4"
                style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
              >
                <div className="grid grid-cols-2 gap-4">
                  {/* Checked In */}
                  <div>
                    <p className="text-xs font-semibold opacity-60 uppercase tracking-wider mb-2">
                      Checked In ({alert.entryCount ?? alert.entryCodes.length} items)
                    </p>
                    {alert.entryCodes.length > 0
                      ? alert.entryCodes.map((c, i) => (
                          <p key={i} className="font-mono text-sm leading-6">{c}</p>
                        ))
                      : <p className="opacity-40 text-xs">—</p>}
                  </div>

                  {/* Checked Out */}
                  <div>
                    <p className="text-xs font-semibold opacity-60 uppercase tracking-wider mb-2">
                      Checked Out ({alert.exitCount ?? alert.exitCodes.length} items)
                    </p>
                    {alert.exitCodes.length > 0
                      ? alert.exitCodes.map((c, i) => (
                          <p key={i} className="font-mono text-sm leading-6">{c}</p>
                        ))
                      : <p className="opacity-40 text-xs">—</p>}
                  </div>
                </div>
              </div>

              {/* Missing codes */}
              {missingCodes.length > 0 && (
                <div
                  className="rounded-xl p-4 mb-4"
                  style={{ backgroundColor: "rgba(0,0,0,0.30)" }}
                >
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#ffaaaa" }}>
                    ⚠ Missing: {missingCodes.join(", ")}
                  </p>
                </div>
              )}

              {/* CCTV */}
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
              >
                <p className="text-xs font-semibold opacity-60 uppercase tracking-wider mb-2">CCTV Footage</p>
                {alert.cctvClipUrl ? (
                  <video
                    src={alert.cctvClipUrl}
                    controls
                    className="w-full rounded-lg"
                    style={{ maxHeight: 200 }}
                  />
                ) : (
                  <p className="text-xs opacity-50 italic">
                    CCTV clip: will appear here once the recording system delivers it.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
