import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/[^/]*$/, "") + "/api";

interface AdminUser { username: string; }

interface FittingRoom {
  id:         number;
  roomId:     string;
  branchCode: string;
  name:       string;
  location:   string;
  status:     "available" | "occupied" | "alert";
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  available: { bg: "#22c55e", text: "#fff" },
  occupied:  { bg: "#ef4444", text: "#fff" },
  alert:     { bg: "#f59e0b", text: "#fff" },
};

const STATUS_CYCLE: FittingRoom["status"][] = ["available", "occupied", "alert"];

function authHeaders() {
  const token = localStorage.getItem("sfr_admin_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function SetupFittingRooms() {
  const [, setLocation]             = useLocation();
  const [admin, setAdmin]           = useState<AdminUser | null>(null);
  const [branches, setBranches]     = useState<string[]>([]);
  const [branch, setBranch]         = useState("");
  const [rooms, setRooms]           = useState<FittingRoom[]>([]);
  const [pending, setPending]       = useState<Map<number, Partial<FittingRoom>>>(new Map());
  const [isSaving, setIsSaving]     = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const { toast }                   = useToast();
  const locationRefs                = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    const token   = localStorage.getItem("sfr_admin_token");
    const userStr = localStorage.getItem("sfr_admin_user");
    if (!token || !userStr) { setLocation("/login"); return; }
    try { setAdmin(JSON.parse(userStr)); } catch { setLocation("/login"); }
  }, [setLocation]);

  useEffect(() => {
    if (!admin) return;
    fetch(`${API_BASE}/fitting-rooms/branches`, { headers: authHeaders() })
      .then(r => r.json())
      .then(setBranches)
      .catch(() => {});
  }, [admin]);

  useEffect(() => {
    if (!branch) { setRooms([]); return; }
    setIsLoading(true);
    fetch(`${API_BASE}/fitting-rooms?branchCode=${encodeURIComponent(branch)}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => { setRooms(data); setPending(new Map()); locationRefs.current = new Map(); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [branch]);

  const markPending = (id: number, changes: Partial<FittingRoom>) => {
    setPending(prev => {
      const next = new Map(prev);
      next.set(id, { ...(next.get(id) ?? {}), ...changes });
      return next;
    });
    setRooms(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r));
  };

  const cycleStatus = (room: FittingRoom) => {
    const idx  = STATUS_CYCLE.indexOf(room.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    markPending(room.id, { status: next });
  };

  const addRoom = async () => {
    if (!branch) { toast({ title: "Select a branch first", variant: "destructive" }); return; }
    const name = `Fitting Room ${rooms.length + 1}`;
    const res  = await fetch(`${API_BASE}/fitting-rooms`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ branchCode: branch, name, location: "", status: "available" }),
    });
    if (res.ok) {
      const room = await res.json();
      setRooms(prev => [...prev, room]);
    }
  };

  const save = async (navigate: boolean) => {
    setIsSaving(true);
    try {
      for (const [id, changes] of pending.entries()) {
        const loc = locationRefs.current.get(id);
        const payload = { ...changes, ...(loc !== undefined ? { location: loc } : {}) };
        await fetch(`${API_BASE}/fitting-rooms/${id}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });
      }
      setPending(new Map());
      locationRefs.current = new Map();
      toast({ title: "Saved", description: "Fitting rooms updated successfully." });
      if (navigate) setLocation("/dashboard");
    } catch {
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!admin) return null;

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: "#1e3f7a" }}>
      <PageHeader title={`Account: (${admin.username})`} breadcrumb="Home/Setup Fitting Rooms" />

      <main className="flex-1 flex flex-col px-8 pt-2 pb-8">

        {/* Branch code selector */}
        <div className="flex items-stretch mb-6 rounded-lg overflow-hidden w-full max-w-xl"
          style={{ border: "2px solid #fff" }}>
          <div className="flex items-center px-5 font-bold text-white text-sm"
            style={{ backgroundColor: "#111827", minWidth: "130px" }}>
            Branch Code
          </div>
          <div className="relative flex-1">
            <select
              value={branch}
              onChange={e => setBranch(e.target.value)}
              className="w-full h-full appearance-none px-4 py-3 text-gray-500 text-sm font-medium focus:outline-none"
              style={{ backgroundColor: "#e0e0e0" }}
            >
              <option value="">Select branch code</option>
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <svg viewBox="0 0 16 10" fill="none" className="w-4 h-3">
                <path d="M1 1l7 8 7-8" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Rooms area */}
        <div className="flex-1 flex items-start gap-4">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-white/60 text-sm py-20">Loading…</div>
          ) : (
            <>
              {/* Room cards grid */}
              <div className="flex-1 grid gap-5" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                {rooms.map(room => {
                  const colors = STATUS_COLORS[room.status];
                  return (
                    <div key={room.id} className="flex flex-col rounded-xl overflow-hidden"
                      style={{ backgroundColor: "#dde3ec", minHeight: "260px" }}>

                      {/* Card header */}
                      <div className="text-center pt-4 pb-1 px-3">
                        <h3 className="font-bold text-gray-800 text-lg">{room.name}</h3>
                        <p className="text-gray-500 text-xs mt-0.5">ID: {room.roomId}</p>
                      </div>

                      {/* Card body */}
                      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4 gap-3">
                        {/* Status toggle */}
                        <button
                          onClick={() => cycleStatus(room)}
                          className="rounded-lg px-6 py-2 font-bold text-sm transition hover:opacity-90 active:scale-[0.97]"
                          style={{ backgroundColor: colors.bg, color: colors.text, minWidth: "100px" }}
                          title="Click to cycle status"
                        >
                          {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                        </button>

                        {/* Location */}
                        <div className="text-xs text-gray-600 w-full text-left">
                          <span className="font-semibold">Location: </span>
                          <input
                            type="text"
                            defaultValue={room.location}
                            onChange={e => {
                              locationRefs.current.set(room.id, e.target.value);
                            }}
                            placeholder="Enter location…"
                            className="bg-transparent border-b border-gray-400 focus:outline-none focus:border-gray-700 text-xs w-full mt-0.5"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add room button */}
              <button
                onClick={addRoom}
                className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold transition hover:brightness-95 active:scale-95 self-center"
                style={{ backgroundColor: "#dde3ec", color: "#555", marginTop: "1rem" }}
                title="Add fitting room"
              >
                +
              </button>
            </>
          )}
        </div>

        {/* Action buttons */}
        {!isLoading && branch && (
          <div className="flex gap-6 mt-6 justify-center">
            <button
              onClick={() => save(false)}
              disabled={isSaving}
              className="rounded-xl px-16 py-3.5 font-semibold text-gray-700 text-base transition hover:brightness-95 active:scale-[0.98]"
              style={{ backgroundColor: "#ffffff", minWidth: "180px" }}
            >
              Apply
            </button>
            <button
              onClick={() => save(true)}
              disabled={isSaving}
              className="rounded-xl px-16 py-3.5 font-semibold text-gray-700 text-base transition hover:brightness-95 active:scale-[0.98]"
              style={{ backgroundColor: "#ffffff", minWidth: "180px" }}
            >
              Ok
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
