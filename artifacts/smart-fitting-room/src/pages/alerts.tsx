import { useEffect, useState } from "react";
import { useLocation } from "wouter";

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
  productCodesIn:              string | null;
  mainEntranceProductCodesIn:  string | null;
  mainEntranceProductCodesOut: string | null;
  mainEntranceEntryTime:       string | null;
  mainEntranceAlertTime:       string | null;
  mainEntranceAlertResolvedAt: string | null;
  fittingRoomName:             string | null;
  fittingRoomEntryTime:        string | null;
  fittingRoomProductCodesIn:   string | null;
  fittingRoomProductCodesOut:  string | null;
  fittingRoomEntryScannedAt:   string | null;
  alertTime:                   string | null;
  exitGarmentCount:            number | null;
  hasAlert:                    boolean;
  cctvClipUrl:                 string | null;
  createdAt:                   string;
}

function parseCodes(raw: string | null): string[] {
  if (!raw) return [];
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }
  catch { return raw.split(",").map(s => s.trim()).filter(Boolean); }
}

function missingCodes(inCodes: string[], outCodes: string[]): string[] {
  const pool = [...outCodes];
  return inCodes.filter(c => {
    const i = pool.indexOf(c);
    if (i !== -1) { pool.splice(i, 1); return false; }
    return true;
  });
}

function fmtTime(t: string | null) {
  if (!t) return "—";
  if (/^\d{3,4}$/.test(t)) {
    const s = t.padStart(4, "0");
    return `${s.slice(0,2)}:${s.slice(2)}`;
  }
  try {
    const d = new Date(t);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  } catch { return t; }
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2,"0");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch { return iso; }
}

const HangerIcon = () => (
  <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 shrink-0">
    <path d="M36 9C32.134 9 29 12.134 29 16C29 19.076 30.981 21.685 33.749 22.643C34.065 23.131 34.463 23.683 34.966 24.344C29.244 26.685 9 35.5 9 46H63C63 35.5 42.756 26.685 37.034 24.344C37.537 23.683 37.935 23.131 38.251 22.643C41.019 21.685 43 19.076 43 16C43 12.134 39.866 9 36 9Z"
      stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="30" y="15" width="12" height="8" rx="1.5" fill="white" opacity="0.95"/>
    <line x1="16" y1="46" x2="16" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
    <line x1="56" y1="46" x2="56" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
  </svg>
);

function userAuthHeaders() {
  const token = localStorage.getItem("sfr_user_token");
  return { Authorization: `Bearer ${token}` };
}

export default function AlertsPage() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<StoreUser | null>(null);
  const [sessions, setSessions] = useState<AlertSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCctv, setExpandedCctv] = useState<number | null>(null);

  useEffect(() => {
    const token   = localStorage.getItem("sfr_user_token");
    const userStr = localStorage.getItem("sfr_user");
    if (!token || !userStr) { setLocation("/user-signin"); return; }
    try { setUser(JSON.parse(userStr)); } catch { setLocation("/user-signin"); }
  }, [setLocation]);

  useEffect(() => {
    if (!user?.branchCode) return;
    setLoading(true);
    fetch(`${API_BASE}/alerts?branchCode=${encodeURIComponent(user.branchCode)}`, {
      headers: userAuthHeaders(),
    })
      .then(r => r.json())
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#1e3a6e" }}>
      {/* Header */}
      <header className="flex items-center gap-4 px-8 pt-5 pb-4">
        <button onClick={() => setLocation("/fitting-rooms")} className="hover:opacity-80 transition" title="Back">
          <HangerIcon />
        </button>
        <div>
          <h1 className="text-white text-3xl font-bold leading-tight">Alerts</h1>
          <p className="text-white/60 text-sm mt-0.5">Home / Fitting Rooms / Alerts</p>
        </div>
      </header>

      <main className="flex-1 px-6 pb-10 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center mt-20 text-white/60 text-sm">Loading alerts…</div>
        ) : sessions.length === 0 ? (
          <div className="flex items-center justify-center mt-20 text-white/60 text-sm">No alerts recorded yet.</div>
        ) : (
          <div className="rounded-2xl overflow-hidden mt-4" style={{ backgroundColor: "#d8dde8" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#b8c2d8" }}>
                  <th className="text-left px-4 py-3 font-bold text-gray-800">Date</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-800">Fitting Room</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-800">Time</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-800">Customer ID</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-800">Products Checked In</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-800">Qty In / Out</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-800 text-red-700">Missing Codes</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-800">Alert Type</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-800">CCTV</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, idx) => {
                  const entryCodes  = parseCodes(s.mainEntranceProductCodesIn  ?? s.fittingRoomProductCodesIn ?? s.productCodesIn);
                  const exitCodes   = parseCodes(s.mainEntranceProductCodesOut ?? s.fittingRoomProductCodesOut);
                  const missing     = missingCodes(entryCodes, exitCodes);
                  const alertTime   = s.mainEntranceAlertTime ?? s.alertTime;
                  const entryTime   = s.mainEntranceEntryTime ?? s.fittingRoomEntryTime;
                  const roomName    = s.fittingRoomName ?? "Main Entrance";
                  const isEntrance  = !!s.mainEntranceAlertTime;
                  const rowBg       = idx % 2 === 0 ? "#d8dde8" : "#cdd3df";

                  return (
                    <tr key={s.id} style={{ backgroundColor: rowBg }}>
                      <td className="px-4 py-3 text-gray-700">{fmtDate(s.createdAt)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{roomName}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <div>Entry: {fmtTime(entryTime)}</div>
                        {alertTime && <div className="text-red-600 font-semibold">Alert: {fmtTime(alertTime)}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-800">
                        {s.customerId ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {entryCodes.length === 0
                          ? <span className="text-gray-400">—</span>
                          : <div className="flex flex-col gap-0.5">
                              {entryCodes.map((c, i) => (
                                <span key={i} className="font-mono text-xs bg-white/60 rounded px-1 py-0.5 inline-block">{c}</span>
                              ))}
                            </div>}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-center">
                        <span>{s.garmentCount ?? "—"}</span>
                        {s.exitGarmentCount !== null && <span className="text-gray-500"> / {s.exitGarmentCount}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {missing.length === 0
                          ? <span className="text-green-700 font-semibold text-xs">None</span>
                          : <div className="flex flex-col gap-0.5">
                              {missing.map((c, i) => (
                                <span key={i} className="font-mono text-xs bg-red-100 text-red-700 rounded px-1 py-0.5 inline-block">{c}</span>
                              ))}
                            </div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${isEntrance ? "bg-red-200 text-red-800" : "bg-orange-200 text-orange-800"}`}>
                          {isEntrance ? "Entrance" : "Fitting Room"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.cctvClipUrl ? (
                          <div>
                            <button
                              onClick={() => setExpandedCctv(expandedCctv === s.id ? null : s.id)}
                              className="text-xs text-blue-700 underline font-semibold hover:text-blue-900"
                            >
                              {expandedCctv === s.id ? "Hide" : "View"} footage
                            </button>
                            {expandedCctv === s.id && (
                              <video src={s.cctvClipUrl} controls className="mt-2 rounded-lg" style={{ maxWidth: 240, maxHeight: 160 }} />
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
