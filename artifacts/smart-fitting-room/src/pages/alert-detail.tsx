import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/[^/]*$/, "") + "/api";

interface StoreUser {
  userId:     string;
  username:   string;
  branchCode: string;
}

interface AlertSession {
  id:                          number;
  branchCode:                  string;
  customerId:                  string | null;
  garmentCount:                number | null;
  exitGarmentCount:            number | null;
  productCodesIn:              string | null;
  mainEntranceProductCodesIn:  string | null;
  mainEntranceProductCodesOut: string | null;
  mainEntranceEntryTime:       string | null;
  mainEntranceExitTime:        string | null;
  mainEntranceAlertTime:       string | null;
  mainEntranceAlertResolvedAt: string | null;
  fittingRoomName:             string | null;
  fittingRoomEntryTime:        string | null;
  fittingRoomExitTime:         string | null;
  fittingRoomProductCodesIn:   string | null;
  fittingRoomProductCodesOut:  string | null;
  fittingRoomEntryScannedAt:   string | null;
  fittingRoomExitScannedAt:    string | null;
  durationMinutes:             number | null;
  alertTime:                   string | null;
  alertAttendantId:            string | null;
  checkoutAttendantId:         string | null;
  cctvClipUrl:                 string | null;
  hasAlert:                    boolean;
  isActive:                    boolean;
  createdAt:                   string;
}

function userAuthHeaders() {
  const token = localStorage.getItem("sfr_user_token");
  return { Authorization: `Bearer ${token}` };
}

function parseCodes(raw: string | null): string[] {
  if (!raw) return [];
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }
  catch { return raw.split(",").map(s => s.trim()).filter(Boolean); }
}

function missingCodeSet(inCodes: string[], outCodes: string[]): Set<string> {
  const pool = [...inCodes];
  for (const c of outCodes) {
    const i = pool.indexOf(c);
    if (i !== -1) pool.splice(i, 1);
  }
  return new Set(pool);
}

function fmtTime(t: string | null): string {
  if (!t) return "—";
  if (/^\d{3,4}$/.test(t)) {
    const s = t.padStart(4, "0");
    return `${s.slice(0, 2)}${s.slice(2)}hrs`;
  }
  try {
    const d = new Date(t);
    if (!isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}hrs`;
    }
  } catch { /* fall through */ }
  return t;
}

function fmtDuration(mins: number | null): string {
  if (mins === null || mins === undefined) return "—";
  if (mins < 60) return `${mins}mins`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}hrs` : `${h}hr ${m}mins`;
}

function fmtDateTime(iso: string): string {
  try {
    const d   = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const yr  = String(d.getFullYear()).slice(2);
    const hh  = String(d.getHours()).padStart(2, "0");
    const mm  = String(d.getMinutes()).padStart(2, "0");
    return `${day}-${months[d.getMonth()]}-${yr}: ${hh}${mm}`;
  } catch { return iso; }
}

const HangerIcon = () => (
  <svg viewBox="0 0 72 72" fill="none" className="w-12 h-12 shrink-0">
    <path d="M36 9C32.134 9 29 12.134 29 16C29 19.076 30.981 21.685 33.749 22.643C34.065 23.131 34.463 23.683 34.966 24.344C29.244 26.685 9 35.5 9 46H63C63 35.5 42.756 26.685 37.034 24.344C37.537 23.683 37.935 23.131 38.251 22.643C41.019 21.685 43 19.076 43 16C43 12.134 39.866 9 36 9Z"
      stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="30" y="15" width="12" height="8" rx="1.5" fill="white" opacity="0.95"/>
    <line x1="16" y1="46" x2="16" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
    <line x1="56" y1="46" x2="56" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
  </svg>
);

const PrintIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="7" y="12" width="18" height="12" rx="2"/>
    <path d="M7 12V7a1 1 0 011-1h16a1 1 0 011 1v5"/>
    <rect x="10" y="18" width="12" height="6" rx="1" fill="white" stroke="none"/>
    <circle cx="10" cy="15" r="1" fill="white" stroke="none"/>
  </svg>
);

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <tr>
      <td className="py-2 pr-4 text-sm font-medium align-top" style={{ color: "#374151", width: 180 }}>{label}</td>
      <td className="py-2 text-sm font-semibold" style={{ color: "#111827" }}>{value ?? "—"}</td>
    </tr>
  );
}

export default function AlertDetailPage() {
  const [, setLocation]   = useLocation();
  const search            = useSearch();
  const params            = new URLSearchParams(search);
  const sessionId         = params.get("id");

  const [user, setUser]         = useState<StoreUser | null>(null);
  const [session, setSession]   = useState<AlertSession | null>(null);
  const [loading, setLoading]   = useState(true);
  const [imgOpen, setImgOpen]   = useState(false);
  const now = new Date();

  useEffect(() => {
    const token   = localStorage.getItem("sfr_user_token");
    const userStr = localStorage.getItem("sfr_user");
    if (!token || !userStr) { setLocation("/user-signin"); return; }
    try { setUser(JSON.parse(userStr)); } catch { setLocation("/user-signin"); }
  }, [setLocation]);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    fetch(`${API_BASE}/alerts/${sessionId}`, { headers: userAuthHeaders() })
      .then(r => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(data => setSession(data))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (!user) return null;

  const customerId = session?.customerId ?? "—";

  // Derive codes
  const codesIn  = parseCodes(session?.mainEntranceProductCodesIn  ?? session?.fittingRoomProductCodesIn ?? session?.productCodesIn ?? null);
  const codesOut = parseCodes(session?.mainEntranceProductCodesOut ?? session?.fittingRoomProductCodesOut ?? null);
  const missing  = missingCodeSet(codesIn, codesOut);

  const dateStr = fmtDateTime(now.toISOString());

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#1e3a6e" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-8 pt-5 pb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setLocation("/alerts")} className="hover:opacity-80 transition" title="Back to Alerts">
            <HangerIcon />
          </button>
          <div>
            <h1 className="text-white text-3xl font-bold leading-tight">
              Account: ({user.username})
            </h1>
            <p className="text-white/60 text-sm mt-0.5">
              Home / Full Details / Customer ID - {customerId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="text-white/80 hover:text-white transition" title="Print">
            <PrintIcon />
          </button>
          <button
            onClick={() => { localStorage.removeItem("sfr_user_token"); localStorage.removeItem("sfr_user"); setLocation("/user-signin"); }}
            className="flex flex-col items-end text-white/80 hover:text-white transition"
          >
            <span className="font-bold text-sm tracking-wide">LOGOUT</span>
            <span className="text-xs text-white/60">{dateStr}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 px-8 pb-12">
        {loading ? (
          <div className="flex items-center justify-center mt-20 text-white/60 text-sm">Loading…</div>
        ) : !session ? (
          <div className="flex items-center justify-center mt-20 text-white/60 text-sm">Alert record not found.</div>
        ) : (
          <div className="flex gap-8 mt-4 flex-wrap">

            {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-0" style={{ width: 300, flexShrink: 0 }}>
              {/* CCTV Image Box */}
              <div
                className="rounded-t-2xl flex flex-col items-center justify-center"
                style={{ backgroundColor: "#4a5568", minHeight: 200 }}
              >
                {session.cctvClipUrl ? (
                  <video
                    src={session.cctvClipUrl}
                    controls
                    className="w-full rounded-t-2xl"
                    style={{ maxHeight: 200, objectFit: "cover" }}
                  />
                ) : (
                  <p className="text-white/50 text-sm font-medium tracking-wide">CCTV IMAGE</p>
                )}
              </div>

              {/* View full image link */}
              <div
                className="flex items-center justify-center py-2 border-b"
                style={{ backgroundColor: "#d8dde8", borderColor: "#b8c2d8" }}
              >
                {session.cctvClipUrl ? (
                  <button
                    onClick={() => setImgOpen(true)}
                    className="text-sm font-medium underline"
                    style={{ color: "#1e3a6e" }}
                  >
                    View Full image
                  </button>
                ) : (
                  <span className="text-sm text-gray-400 italic">No footage yet</span>
                )}
              </div>

              {/* Detail list */}
              <div className="rounded-b-2xl overflow-hidden" style={{ backgroundColor: "#d8dde8" }}>
                <table className="w-full">
                  <tbody>
                    <DetailRow label="Customer ID"                      value={customerId} />
                    <DetailRow label="Main Fitting Room Entrance entry time" value={fmtTime(session.mainEntranceEntryTime)} />
                    <DetailRow label="Number of garments checked in"    value={session.garmentCount !== null ? String(session.garmentCount).padStart(2, "0") : "—"} />
                    <DetailRow label="Fitting Room Occupied"            value={session.fittingRoomName} />
                    <DetailRow label="Fitting Room occupation duration" value={fmtDuration(session.durationMinutes)} />
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── RIGHT PANEL — report table ─────────────────────────────────── */}
            <div className="flex-1 min-w-0">
              <div className="rounded-2xl overflow-x-auto" style={{ backgroundColor: "#d8dde8" }}>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: "#b8c2d8" }}>
                      <th className="px-4 py-3 text-left font-bold text-gray-800 whitespace-nowrap">Customer ID</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-800 whitespace-nowrap">Products checked in</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-800 whitespace-nowrap">Product codes checked out</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-800 whitespace-nowrap">
                        Main Fitting Room<br />Entrance exit time
                      </th>
                      <th className="px-4 py-3 text-left font-bold text-gray-800 whitespace-nowrap">
                        Main Fitting Room<br />Entrance Alert Time
                      </th>
                      <th className="px-4 py-3 text-left font-bold text-gray-800 whitespace-nowrap">Alert Attendant</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ backgroundColor: "#d8dde8" }}>
                      {/* Customer ID */}
                      <td className="px-4 py-4 font-mono text-xs align-top">{customerId}</td>

                      {/* Products checked in */}
                      <td className="px-4 py-4 align-top">
                        {codesIn.length === 0
                          ? <span className="text-gray-400">—</span>
                          : <div className="flex flex-col gap-1">
                              {codesIn.map((c, i) => (
                                <span key={i} className="font-mono text-xs">{c}</span>
                              ))}
                            </div>}
                      </td>

                      {/* Products checked out — missing ones in red */}
                      <td className="px-4 py-4 align-top">
                        {codesOut.length === 0
                          ? <span className="text-gray-400">—</span>
                          : <div className="flex flex-col gap-1">
                              {codesOut.map((c, i) => (
                                <span
                                  key={i}
                                  className="font-mono text-xs font-semibold"
                                  style={{ color: missing.has(c) ? "#dc2626" : "#111827" }}
                                >
                                  {c}
                                </span>
                              ))}
                            </div>}
                        {missing.size > 0 && codesOut.length === 0 && (
                          <div className="flex flex-col gap-1 mt-1">
                            {[...missing].map((c, i) => (
                              <span key={i} className="font-mono text-xs font-semibold" style={{ color: "#dc2626" }}>{c}</span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Main FR Entrance exit time */}
                      <td className="px-4 py-4 align-top font-mono text-xs">
                        {fmtTime(session.mainEntranceExitTime)}
                      </td>

                      {/* Main FR Entrance Alert Time */}
                      <td className="px-4 py-4 align-top font-mono text-xs font-bold" style={{ color: "#dc2626" }}>
                        {fmtTime(session.mainEntranceAlertTime ?? session.alertTime)}
                      </td>

                      {/* Alert Attendant */}
                      <td className="px-4 py-4 align-top text-xs">
                        {session.alertAttendantId
                          ? <span>Employee ID: <strong>{session.alertAttendantId}</strong></span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Supplementary info row */}
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="rounded-xl px-5 py-4" style={{ backgroundColor: "#d8dde8" }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#6b7280" }}>Fitting Room Entry</p>
                  <p className="text-base font-bold text-gray-900">{fmtTime(session.fittingRoomEntryTime)}</p>
                </div>
                <div className="rounded-xl px-5 py-4" style={{ backgroundColor: "#d8dde8" }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#6b7280" }}>Fitting Room Exit</p>
                  <p className="text-base font-bold text-gray-900">{fmtTime(session.fittingRoomExitTime)}</p>
                </div>
                <div className="rounded-xl px-5 py-4" style={{ backgroundColor: "#d8dde8" }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#6b7280" }}>Main Entrance Exit</p>
                  <p className="text-base font-bold text-gray-900">{fmtTime(session.mainEntranceExitTime)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Full-screen CCTV overlay */}
      {imgOpen && session?.cctvClipUrl && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.88)" }}
          onClick={() => setImgOpen(false)}
        >
          <video
            src={session.cctvClipUrl}
            controls
            autoPlay
            className="rounded-2xl"
            style={{ maxWidth: "92vw", maxHeight: "88vh" }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
