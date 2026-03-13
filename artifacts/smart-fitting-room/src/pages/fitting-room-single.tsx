import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/[^/]*$/, "") + "/api";

interface StoreUser {
  userId:     string;
  username:   string;
  forenames:  string;
  surname:    string;
  rights:     string;
  branchCode: string;
}

interface FittingRoom {
  id:             number;
  roomId:         string;
  name:           string;
  status:         "available" | "occupied" | "alert";
  garmentCount:   number | null;
}

interface Session {
  id:                   number;
  fittingRoomName:      string | null;
  fittingRoomEntryTime: string | null;
  fittingRoomExitTime:  string | null;
  durationMinutes:      number | null;
  garmentCount:         number | null;
  productCodesIn:       string | null;
  alertTime:            string | null;
  alertAttendantId:     string | null;
  hasAlert:             boolean;
  isActive:             boolean;
}

function userAuthHeaders() {
  const token = localStorage.getItem("sfr_user_token");
  return { Authorization: `Bearer ${token}` };
}

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function formatCodes(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split("|").map(s => s.trim()).filter(Boolean);
}

function formatDuration(mins: number | null): string {
  if (mins === null || mins === undefined) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}mins`;
  return m === 0 ? `${h}hrs` : `${h}hr ${m}mins`;
}

function liveDuration(entryTimeText: string | null, now: Date): string {
  if (!entryTimeText || entryTimeText.length < 3) return "";
  const hh = parseInt(entryTimeText.slice(0, entryTimeText.length - 2), 10);
  const mm = parseInt(entryTimeText.slice(-2), 10);
  if (isNaN(hh) || isNaN(mm)) return "";
  const entry = new Date(now);
  entry.setHours(hh, mm, 0, 0);
  const diffMins = Math.max(0, Math.floor((now.getTime() - entry.getTime()) / 60000));
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  if (h === 0) return `${m}mins`;
  return m === 0 ? `${h}hrs` : `${h}hr ${m}mins`;
}

function formatGarments(count: number | null): string {
  if (count === null || count === undefined) return "—";
  return `${String(count).padStart(2, "0")} garment${count === 1 ? "" : "s"}`;
}

const statusLabel: Record<string, string> = {
  available: "Vacant",
  occupied:  "Occupied",
  alert:     "Alert",
};

type SortKey = "fittingRoomEntryTime" | "durationMinutes";

const SortIcon = () => (
  <span className="inline-flex flex-col leading-none ml-0.5 opacity-80" style={{ fontSize: "8px" }}>
    <span>▲</span><span>▼</span>
  </span>
);

export default function FittingRoomSingle() {
  const [, setLocation] = useLocation();
  const search          = useSearch();
  const params          = new URLSearchParams(search);
  const roomId          = params.get("roomId")  ?? "";
  const roomName        = params.get("name")    ?? "Fitting Room";

  const [user, setUser]       = useState<StoreUser | null>(null);
  const [room, setRoom]       = useState<FittingRoom | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
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
    if (!user?.branchCode || !roomId) return;

    // Load the specific room info
    fetch(
      `${API_BASE}/fitting-rooms?branchCode=${encodeURIComponent(user.branchCode)}`,
      { headers: userAuthHeaders() }
    )
      .then(r => r.json())
      .then((rooms: FittingRoom[]) => {
        const found = rooms.find(r => r.roomId === roomId);
        if (found) setRoom(found);
      })
      .catch(() => {});

    // Load sessions for this room
    setLoading(true);
    fetch(
      `${API_BASE}/fitting-room-sessions?branchCode=${encodeURIComponent(user.branchCode)}&fittingRoomName=${encodeURIComponent(roomName)}&page=${page}&limit=50`,
      { headers: userAuthHeaders() }
    )
      .then(r => r.json())
      .then(d => {
        setSessions(Array.isArray(d.data) ? d.data : []);
        setTotalPages(d.totalPages ?? 1);
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [user, roomId, roomName, page]);

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
  const currentStatus = room ? statusLabel[room.status] ?? room.status : "—";

  const TH = ({
    children, sortable, sortK,
  }: { children: React.ReactNode; sortable?: boolean; sortK?: SortKey }) => (
    <th
      className="border border-gray-400 px-3 py-2.5 text-left text-sm font-semibold text-white leading-tight"
      style={{ backgroundColor: "#6b748a", verticalAlign: "top", cursor: sortable ? "pointer" : "default" }}
      onClick={() => sortable && sortK && handleSort(sortK)}
    >
      {children}
      {sortable && <SortIcon />}
    </th>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#1e3a6e" }}>

      {/* Header */}
      <header className="px-6 pt-4 pb-2">
        <div className="flex items-start justify-between">

          {/* Left: hanger (home button) + title + breadcrumb + status */}
          <div className="flex items-start gap-3">
            <button
              onClick={() => setLocation("/user-dashboard")}
              className="shrink-0 mt-1 hover:opacity-80 transition"
              title="Go to Home"
              aria-label="Home"
            >
              <HangerIcon />
            </button>

            <div>
              <h1 className="text-white text-3xl font-bold leading-tight">
                Account: ({user.username})
              </h1>
              <p className="text-white/70 text-sm mt-0.5">
                <button
                  onClick={() => setLocation("/fitting-rooms")}
                  className="hover:underline"
                >
                  Home
                </button>
                /View Details- {roomName} - {roomId}
              </p>
              <p className="text-white font-bold text-sm mt-1">
                Status: {currentStatus}
              </p>
            </div>
          </div>

          {/* Right: logout */}
          <button
            onClick={handleLogout}
            className="flex flex-col items-end text-white/80 hover:text-white transition"
          >
            <span className="font-bold text-sm tracking-wide">LOGOUT</span>
            <span className="text-xs text-white/60">{dateStr}: {timeStr}</span>
          </button>
        </div>
      </header>

      {/* Table */}
      <main className="flex-1 px-6 pb-4 mt-2 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-white/60 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-collapse w-full text-sm" style={{ backgroundColor: "#e4e8f0" }}>
              <thead>
                <tr>
                  <TH>Fitting Room Name</TH>
                  <TH>Fitting Room ID</TH>
                  <TH sortable sortK="fittingRoomEntryTime">Entry Time</TH>
                  <TH>Number of garments</TH>
                  <TH>Product Codes</TH>
                  <TH>Exit Time</TH>
                  <TH sortable sortK="durationMinutes">Duration</TH>
                  <TH>Alert</TH>
                  <TH>Alert attendant</TH>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-gray-500 text-sm">
                      No sessions recorded for this fitting room yet.
                    </td>
                  </tr>
                ) : (
                  sortedSessions.map((s, idx) => {
                    const bg    = idx % 2 === 0 ? "white" : "#edf0f5";
                    const codes = formatCodes(s.productCodesIn);

                    return (
                      <tr key={s.id} style={{ backgroundColor: bg }}>
                        <td className="border border-gray-300 px-3 py-3 align-top">
                          {s.fittingRoomName ?? roomName}
                        </td>
                        <td className="border border-gray-300 px-3 py-3 align-top font-mono text-xs">
                          {roomId}
                        </td>
                        <td className="border border-gray-300 px-3 py-3 align-top">
                          {s.fittingRoomEntryTime ?? "—"}
                        </td>
                        <td className="border border-gray-300 px-3 py-3 align-top">
                          {formatGarments(s.garmentCount)}
                        </td>
                        <td className="border border-gray-300 px-3 py-3 align-top">
                          {codes.length ? codes.map((c, i) => <div key={i}>{c}</div>) : "—"}
                        </td>
                        <td className="border border-gray-300 px-3 py-3 align-top">
                          {s.fittingRoomExitTime ?? ""}
                        </td>
                        <td className="border border-gray-300 px-3 py-3 align-top">
                          {s.isActive
                            ? liveDuration(s.fittingRoomEntryTime, now)
                            : formatDuration(s.durationMinutes)}
                        </td>
                        <td className="border border-gray-300 px-3 py-3 align-top">
                          {s.alertTime ?? "-"}
                        </td>
                        <td className="border border-gray-300 px-3 py-3 align-top">
                          {s.alertAttendantId ?? ""}
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
