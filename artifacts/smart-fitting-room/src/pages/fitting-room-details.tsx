import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/[^/]*$/, "") + "/api";

interface StoreUser {
  userId:     string;
  username:   string;
  forenames:  string;
  surname:    string;
  rights:     string;
  branchCode: string;
}

interface Session {
  id:                    number;
  branchCode:            string;
  mainEntranceEntryTime: string | null;
  customerId:            string | null;
  garmentCount:          number | null;
  productCodesIn:        string | null;
  fittingRoomName:       string | null;
  fittingRoomEntryTime:  string | null;
  fittingRoomExitTime:   string | null;
  durationMinutes:       number | null;
  alertTime:             string | null;
  alertAttendantId:      string | null;
  mainEntranceExitTime:  string | null;
  mainEntranceAlertTime: string | null;
  productCodesOut:       string | null;
  exitGarmentCount:      number | null;
  checkoutAttendantId:   string | null;
  hasAlert:              boolean;
  isActive:              boolean;
}

function userAuthHeaders() {
  const token = localStorage.getItem("sfr_user_token");
  return { Authorization: `Bearer ${token}` };
}

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const HangerIcon = () => (
  <svg viewBox="0 0 72 72" fill="none" className="w-12 h-12 shrink-0">
    <path
      d="M36 9C32.134 9 29 12.134 29 16C29 19.076 30.981 21.685 33.749 22.643C34.065 23.131 34.463 23.683 34.966 24.344C29.244 26.685 9 35.5 9 46H63C63 35.5 42.756 26.685 37.034 24.344C37.537 23.683 37.935 23.131 38.251 22.643C41.019 21.685 43 19.076 43 16C43 12.134 39.866 9 36 9Z"
      stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
    />
    <rect x="30" y="15" width="12" height="8" rx="1.5" fill="white" opacity="0.95" />
    <line x1="16" y1="46" x2="16" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="56" y1="46" x2="56" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

const PrinterIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8" stroke="white" strokeWidth="1.8">
    <rect x="6" y="10" width="20" height="14" rx="2" />
    <path d="M10 10V6h12v4" strokeLinecap="round" />
    <rect x="10" y="17" width="12" height="7" fill="white" stroke="none" rx="1" />
    <circle cx="24" cy="14" r="1" fill="white" stroke="none" />
  </svg>
);

const SortIcon = () => (
  <span className="inline-flex flex-col leading-none ml-0.5 opacity-80" style={{ fontSize: "8px" }}>
    <span>▲</span>
    <span>▼</span>
  </span>
);

function formatCodes(raw: string | null): { lines: string[]; } {
  if (!raw) return { lines: [] };
  return { lines: raw.split("|").map(s => s.trim()).filter(Boolean) };
}

function formatDuration(mins: number | null): string {
  if (mins === null || mins === undefined) return "";
  return `${mins}mins`;
}

type SortKey = "fittingRoomEntryTime" | "fittingRoomExitTime" | "durationMinutes" | "alertTime";

export default function FittingRoomDetails() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<StoreUser | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const now = useLiveClock();

  useEffect(() => {
    const token   = localStorage.getItem("sfr_user_token");
    const userStr = localStorage.getItem("sfr_user");
    if (!token || !userStr) { setLocation("/user-signin"); return; }
    try { setUser(JSON.parse(userStr)); } catch { setLocation("/user-signin"); }
  }, [setLocation]);

  useEffect(() => {
    if (!user?.branchCode) return;
    setLoading(true);
    fetch(
      `${API_BASE}/fitting-room-sessions?branchCode=${encodeURIComponent(user.branchCode)}&page=${page}&limit=50`,
      { headers: userAuthHeaders() }
    )
      .then(r => r.json())
      .then(d => {
        setSessions(Array.isArray(d.data) ? d.data : []);
        setTotalPages(d.totalPages ?? 1);
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [user, page]);

  const handleLogout = () => {
    localStorage.removeItem("sfr_user_token");
    localStorage.removeItem("sfr_user");
    setLocation("/user-signin");
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortAsc ? cmp : -cmp;
  });

  if (!user) return null;

  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replace(/ /g, "-");
  const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  const TH = ({
    children, sortable, sortK,
  }: { children: React.ReactNode; sortable?: boolean; sortK?: SortKey }) => (
    <th
      className="border border-gray-400 px-2 py-2 text-left text-xs font-semibold text-white leading-tight"
      style={{ backgroundColor: "#888fa0", verticalAlign: "top", minWidth: "80px", cursor: sortable ? "pointer" : "default" }}
      onClick={() => sortable && sortK && handleSort(sortK)}
    >
      {children}
      {sortable && <SortIcon />}
    </th>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#1e3a6e" }}>

      {/* Header */}
      <header className="px-6 pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/user-dashboard")}
              className="hover:opacity-80 transition shrink-0"
              title="Go to Home"
              aria-label="Home"
            >
              <HangerIcon />
            </button>
            <div>
              <h1 className="text-white text-3xl font-bold">Account: ({user.username})</h1>
              <p className="text-white/70 text-sm mt-0.5 ml-1">
                <button
                  onClick={() => setLocation("/fitting-rooms")}
                  className="hover:underline hover:text-white transition"
                >
                  Home
                </button>
                /Fitting Room Details
              </p>
            </div>
          </div>

          <div className="flex items-start gap-8">
            <div className="flex items-center gap-3">
              <PrinterIcon />
              <div className="flex items-center gap-2 text-white text-sm font-medium">
                <span className="text-white/80">•</span>
                <span>Filter/Sort</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex flex-col items-end text-white/80 hover:text-white transition"
            >
              <span className="font-bold text-sm tracking-wide">LOGOUT</span>
              <span className="text-xs text-white/60">{dateStr}: {timeStr}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Table */}
      <main className="flex-1 px-6 pb-4 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-white/60 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto rounded-sm">
            <table className="border-collapse w-full text-xs" style={{ backgroundColor: "#e8eaf0" }}>
              <thead>
                <tr>
                  <TH>Main Fitting Room Entrance - entry time</TH>
                  <TH>Customer ID</TH>
                  <TH>Number of garments</TH>
                  <TH>Product Codes checked in</TH>
                  <TH>Fitting Room occupied</TH>
                  <TH sortable sortK="fittingRoomEntryTime">Fitting Room Entry Time</TH>
                  <TH sortable sortK="fittingRoomExitTime">Fitting Room Exit Time</TH>
                  <TH sortable sortK="durationMinutes">Duration</TH>
                  <TH sortable sortK="alertTime">Fitting Room Alert</TH>
                  <TH>Fitting Room Alert Attendant</TH>
                  <TH>Main Fitting Room Entrance – Exit Time</TH>
                  <TH>Main Fitting Room Entrance Alert</TH>
                  <TH>Product Codes Checked out</TH>
                  <TH>Garments Out</TH>
                  <TH>Variance</TH>
                  <TH>Alert Attendant</TH>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="text-center py-8 text-gray-500 text-sm">
                      No sessions recorded yet.
                    </td>
                  </tr>
                ) : (
                  sortedSessions.map((s, idx) => {
                    const rowAlert   = s.hasAlert && s.isActive;
                    const rowChecked = s.hasAlert && !s.isActive;
                    const codesIn  = formatCodes(s.productCodesIn);
                    const codesOut = formatCodes(s.productCodesOut);

                    const tdBase = "border border-gray-300 px-2 py-2 align-top";
                    const bg     = idx % 2 === 0 ? "white" : "#f0f2f7";

                    return (
                      <tr key={s.id} style={{ backgroundColor: bg }}>
                        <td className={tdBase}>{s.mainEntranceEntryTime ?? "—"}</td>
                        <td className={tdBase}>{s.customerId ?? "—"}</td>

                        {/* garment count — red if active alert */}
                        <td className={`${tdBase} ${rowAlert ? "text-red-600 font-semibold" : ""}`}>
                          {s.garmentCount !== null
                            ? `${String(s.garmentCount).padStart(2, "0")} garments`
                            : "—"}
                        </td>

                        {/* product codes in — red if active alert */}
                        <td className={`${tdBase} ${rowAlert ? "text-red-600 font-semibold" : ""}`}>
                          {codesIn.lines.length ? codesIn.lines.map((c, i) => <div key={i}>{c}</div>) : "—"}
                        </td>

                        {/* fitting room — red if active alert */}
                        <td className={`${tdBase} ${rowAlert ? "text-red-600 font-semibold" : ""}`}>
                          {s.fittingRoomName ?? "—"}
                        </td>

                        <td className={tdBase}>{s.fittingRoomEntryTime ?? "—"}</td>
                        <td className={tdBase}>{s.fittingRoomExitTime ?? ""}</td>
                        <td className={tdBase}>{formatDuration(s.durationMinutes)}</td>

                        {/* alert time — red if alert */}
                        <td className={`${tdBase} ${(rowAlert) ? "text-red-600 font-semibold" : ""}`}>
                          {s.alertTime ?? (s.hasAlert ? "" : "-")}
                        </td>

                        <td className={tdBase}>{s.alertAttendantId ?? (s.hasAlert && s.isActive ? "" : "-")}</td>
                        <td className={tdBase}>{s.mainEntranceExitTime ?? ""}</td>
                        <td className={tdBase}>{s.mainEntranceAlertTime ?? ""}</td>

                        {/* product codes out — red if completed alert */}
                        <td className={`${tdBase} ${rowChecked && codesOut.lines.length ? "text-red-600 font-semibold" : ""}`}>
                          {codesOut.lines.length ? codesOut.lines.map((c, i) => <div key={i}>{c}</div>) : ""}
                        </td>

                        {/* garments out */}
                        <td className={tdBase}>
                          {s.exitGarmentCount !== null && s.exitGarmentCount !== undefined
                            ? `${String(s.exitGarmentCount).padStart(2, "0")} garments`
                            : "—"}
                        </td>

                        {/* variance — red if positive (garments missing) */}
                        {(() => {
                          const diff =
                            s.garmentCount !== null && s.exitGarmentCount !== null
                              ? s.garmentCount - s.exitGarmentCount
                              : null;
                          const isVariance = diff !== null && diff > 0;
                          return (
                            <td className={`${tdBase} ${isVariance ? "text-red-600 font-bold" : ""}`}>
                              {diff === null ? "—" : diff === 0 ? "0" : `−${diff}`}
                            </td>
                          );
                        })()}

                        {/* checkout attendant — red if completed alert */}
                        <td className={`${tdBase} ${rowChecked && s.checkoutAttendantId ? "text-red-600 font-semibold" : ""}`}>
                          {s.checkoutAttendantId ?? ""}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between px-6 py-3 text-sm text-white/80">
        <button
          onClick={() => setLocation("/fitting-rooms")}
          className="hover:text-white transition"
        >
          Home/Notifications
        </button>
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-4">
          <button
            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
            disabled={page >= totalPages}
            className="hover:text-white disabled:opacity-40 transition"
          >
            NEXT
          </button>
          <span className="opacity-40">/</span>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages}
            className="hover:text-white disabled:opacity-40 transition"
          >
            LAST
          </button>
        </div>
      </footer>
    </div>
  );
}
