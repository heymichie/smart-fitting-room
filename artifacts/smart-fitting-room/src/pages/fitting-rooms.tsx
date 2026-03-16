import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import AlertModal from "../components/AlertModal";
import MainEntranceAlertModal, { type EntranceAlertPayload } from "../components/MainEntranceAlertModal";

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
  id:                  number;
  roomId:              string;
  branchCode:          string;
  name:                string;
  location:            string;
  status:              "available" | "occupied" | "alert";
  occupiedSince:       string | null;
  alertSince:          string | null;
  lastOccupiedAt:      string | null;
  garmentCount:        number | null;
  activeEntryTime:     string | null;
  sessionLastExitTime: string | null;
}

function userAuthHeaders() {
  const token = localStorage.getItem("sfr_user_token");
  return { Authorization: `Bearer ${token}` };
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}${mm}hrs`;
}

function formatDuration(activeEntryTime: string | null, now: Date): string {
  // Prefer entry time text "HHMM" → parse as today's local time
  if (activeEntryTime && activeEntryTime.length >= 3) {
    const hh = parseInt(activeEntryTime.slice(0, activeEntryTime.length - 2), 10);
    const mm = parseInt(activeEntryTime.slice(-2), 10);
    if (!isNaN(hh) && !isNaN(mm)) {
      const entry = new Date(now);
      entry.setHours(hh, mm, 0, 0);
      const totalMins = Math.max(0, Math.floor((now.getTime() - entry.getTime()) / 60000));
      const hrs  = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      if (hrs === 0) return `${mins}mins`;
      return mins === 0 ? `${hrs}hrs` : `${hrs}hr ${mins}mins`;
    }
  }
  return "—";
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mon = months[d.getMonth()];
  const yr  = String(d.getFullYear()).slice(2);
  const hh  = String(d.getHours()).padStart(2, "0");
  const mm  = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${mon} ${yr}; ${hh}${mm}`;
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
  <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12">
    <path
      d="M36 9C32.134 9 29 12.134 29 16C29 19.076 30.981 21.685 33.749 22.643C34.065 23.131 34.463 23.683 34.966 24.344C29.244 26.685 9 35.5 9 46H63C63 35.5 42.756 26.685 37.034 24.344C37.537 23.683 37.935 23.131 38.251 22.643C41.019 21.685 43 19.076 43 16C43 12.134 39.866 9 36 9Z"
      stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
    />
    <rect x="30" y="15" width="12" height="8" rx="1.5" fill="white" opacity="0.95" />
    <line x1="16" y1="46" x2="16" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="56" y1="46" x2="56" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

const BellIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7" stroke="white" strokeWidth="2">
    <path d="M16 4C11 4 8 8 8 13v6l-2 3h20l-2-3v-6c0-5-3-9-8-9z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 25a3 3 0 006 0" strokeLinecap="round" />
  </svg>
);

function StatusBadge({ status }: { status: FittingRoom["status"] }) {
  const map = {
    available: { label: "Vacant",   bg: "#27ae60" },
    occupied:  { label: "Occupied", bg: "#e74c3c" },
    alert:     { label: "Alert",    bg: "#e6a817" },
  };
  const { label, bg } = map[status];
  return (
    <span
      className="block rounded-md py-2 text-white font-bold text-base text-center w-full"
      style={{ backgroundColor: bg }}
    >
      {label}
    </span>
  );
}

function RoomCard({ room, now }: { room: FittingRoom; now: Date }) {
  const [, setLocation] = useLocation();
  const garments = (room.garmentCount !== null && room.garmentCount !== undefined)
    ? String(room.garmentCount).padStart(2, "0")
    : "—";

  return (
    <div className="flex flex-col items-center">
      <h3 className="text-white font-bold text-2xl mb-1">{room.name}</h3>
      <p className="text-white/70 text-sm mb-3">ID: {room.roomId}</p>

      <div
        className="w-full rounded-2xl flex flex-col items-center py-7 px-6 gap-4"
        style={{ backgroundColor: "#d8dde8", minHeight: "220px" }}
      >
        <StatusBadge status={room.status} />

        <div className="text-center text-sm text-gray-700 space-y-1 w-full">
          {room.status === "available" && (
            <p>Last Occupied: {room.sessionLastExitTime ? `${room.sessionLastExitTime}hrs` : formatTime(room.lastOccupiedAt)}</p>
          )}
          {room.status === "occupied" && (
            <>
              <p>Entry Time: {room.activeEntryTime ? `${room.activeEntryTime}hrs` : formatTime(room.occupiedSince)}</p>
              <p>Duration: {formatDuration(room.activeEntryTime, now)}</p>
              <p>Number of garments: {garments}</p>
            </>
          )}
          {room.status === "alert" && (
            <>
              <p>Entry Time: {room.activeEntryTime ? `${room.activeEntryTime}hrs` : formatTime(room.occupiedSince)}</p>
              <p>Duration: {formatDuration(room.activeEntryTime, now)}</p>
              <p>Time of alert: {formatTime(room.alertSince)}</p>
              <p>Number of garments: {garments}</p>
            </>
          )}
        </div>

        <button
          onClick={() => setLocation(`/fitting-room-single?roomId=${encodeURIComponent(room.roomId)}&name=${encodeURIComponent(room.name)}`)}
          className="mt-auto text-sm text-gray-500 hover:text-gray-900 font-medium transition"
        >
          View details
        </button>
      </div>
    </div>
  );
}

export default function FittingRoomsPage() {
  const [, setLocation]   = useLocation();
  const [user, setUser]   = useState<StoreUser | null>(null);
  const [rooms, setRooms] = useState<FittingRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const sseRef = useRef<EventSource | null>(null);
  const now    = useLiveClock();

  const [activeAlert, setActiveAlert]         = useState<FittingRoom | null>(null);
  const [entranceAlert, setEntranceAlert]     = useState<EntranceAlertPayload | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());

  const triggerAlert = (updatedRooms: FittingRoom[]) => {
    const alertRoom = updatedRooms.find(
      r => r.status === "alert" && !dismissedRef.current.has(r.roomId)
    );
    setActiveAlert(alertRoom ?? null);
  };

  const handleIgnore = () => {
    if (activeAlert) dismissedRef.current.add(activeAlert.roomId);
    setActiveAlert(null);
  };

  useEffect(() => {
    const token   = localStorage.getItem("sfr_user_token");
    const userStr = localStorage.getItem("sfr_user");
    if (!token || !userStr) { setLocation("/user-signin"); return; }
    try { setUser(JSON.parse(userStr)); } catch { setLocation("/user-signin"); }
  }, [setLocation]);

  useEffect(() => {
    if (!user?.branchCode) return;

    setLoading(true);
    fetch(`${API_BASE}/fitting-rooms?branchCode=${encodeURIComponent(user.branchCode)}`, {
      headers: userAuthHeaders(),
    })
      .then(r => r.json())
      .then(data => {
        const fetched = Array.isArray(data) ? data : [];
        setRooms(fetched);
        triggerAlert(fetched);
      })
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));

    const es = new EventSource(
      `${API_BASE}/fitting-rooms/events?branchCode=${encodeURIComponent(user.branchCode)}`
    );
    sseRef.current = es;

    es.addEventListener("status-update", (e) => {
      const payload = JSON.parse((e as MessageEvent).data);
      setRooms(prev => {
        const prevRoom = prev.find(r => r.id === payload.id);
        const updated = prev.map(r =>
          r.id === payload.id
            ? {
                ...r,
                status:         payload.status,
                occupiedSince:  "occupiedSince"  in payload ? payload.occupiedSince  : r.occupiedSince,
                alertSince:     "alertSince"     in payload ? payload.alertSince     : r.alertSince,
                lastOccupiedAt: "lastOccupiedAt" in payload ? payload.lastOccupiedAt : r.lastOccupiedAt,
                garmentCount:   "garmentCount"   in payload ? payload.garmentCount   : r.garmentCount,
              }
            : r
        );
        // If a room just transitioned INTO alert (was not alert before), clear its
        // dismissed status so the modal fires again for this new alert event.
        if (payload.status === "alert" && prevRoom && prevRoom.status !== "alert") {
          dismissedRef.current.delete(payload.roomId);
        }
        triggerAlert(updated);
        return updated;
      });
    });

    // Main entrance alert
    es.addEventListener("entrance-alert", (e) => {
      const payload = JSON.parse((e as MessageEvent).data) as EntranceAlertPayload;
      setEntranceAlert(payload);
    });

    // CCTV clip delivered — update current entrance alert if it belongs to same session
    es.addEventListener("entrance-cctv-ready", (e) => {
      const { sessionId, cctvClipUrl } = JSON.parse((e as MessageEvent).data);
      setEntranceAlert(prev =>
        prev && prev.sessionId === sessionId ? { ...prev, cctvClipUrl } : prev
      );
    });

    // Alert resolved by another terminal
    es.addEventListener("entrance-alert-resolved", (e) => {
      const { sessionId } = JSON.parse((e as MessageEvent).data);
      setEntranceAlert(prev => (prev && prev.sessionId === sessionId ? null : prev));
    });

    return () => { es.close(); };
  }, [user]);

  function handleLogout() {
    localStorage.removeItem("sfr_user_token");
    localStorage.removeItem("sfr_user");
    setLocation("/user-signin");
  }

  if (!user) return null;

  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replace(/ /g, "-");
  const timeStr = `${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}`;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#1e3a6e" }}>

      {activeAlert && (
        <AlertModal
          roomId={activeAlert.roomId}
          roomName={activeAlert.name}
          branchCode={activeAlert.branchCode}
          roomDbId={activeAlert.id}
          onIgnore={handleIgnore}
        />
      )}

      {entranceAlert && (
        <MainEntranceAlertModal
          alert={entranceAlert}
          onClose={() => setEntranceAlert(null)}
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-8 pt-5 pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocation("/user-dashboard")}
            className="hover:opacity-80 transition"
            title="Go to Home"
            aria-label="Home"
          >
            <HangerIcon />
          </button>
          <div>
            <h1 className="text-white text-3xl font-bold leading-tight">
              Welcome ({user.username})
            </h1>
            <p className="text-white/60 text-sm mt-0.5">Home/</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="text-white/80 hover:text-white transition mr-1">
            <BellIcon />
          </button>
          <button
            onClick={handleLogout}
            className="flex flex-col items-end text-white/80 hover:text-white transition"
          >
            <span className="font-bold text-sm tracking-wide">LOGOUT</span>
            <span className="text-xs text-white/60">{dateStr}: {timeStr}</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center px-8 pb-10">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-white/60 text-sm">
            Loading fitting rooms…
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-white/60 text-sm">
            No fitting rooms configured for your branch.
          </div>
        ) : (
          <>
            <div
              className="w-full grid gap-8 mt-4"
              style={{ gridTemplateColumns: `repeat(${Math.min(rooms.length, 3)}, 1fr)`, maxWidth: "900px" }}
            >
              {rooms.map(room => <RoomCard key={room.id} room={room} now={now} />)}
            </div>

            <button
              onClick={() => setLocation("/fitting-room-details")}
              className="mt-8 text-white/80 hover:text-white text-sm underline underline-offset-2 transition"
            >
              View Full Fitting Room Details
            </button>
          </>
        )}
      </main>
    </div>
  );
}
