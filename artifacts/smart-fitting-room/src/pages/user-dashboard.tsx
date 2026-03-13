import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface StoreUser {
  userId:    string;
  username:  string;
  forenames: string;
  surname:   string;
  rights:    string;
  branchCode: string;
}

const rightsLabel: Record<string, string> = {
  store_manager:    "Store Manager",
  store_supervisor: "Store Supervisor",
  administrator:    "Administrator",
};

// Tiles available to each role (additive — higher roles inherit lower ones)
const tilesByRole: Record<string, { label: string; description: string; icon: JSX.Element; route?: string }[]> = {
  store_supervisor: [
    {
      label: "Fitting Rooms",
      description: "Monitor room occupancy and alerts in real time",
      route: "/fitting-rooms",
      icon: (
        <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="8" width="36" height="34" rx="3" strokeLinecap="round"/>
          <path d="M18 8v34M6 22h12" strokeLinecap="round"/>
          <circle cx="13" cy="28" r="2.5" fill="currentColor" stroke="none"/>
        </svg>
      ),
    },
    {
      label: "Alerts",
      description: "View and respond to fitting room notifications",
      icon: (
        <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" stroke="currentColor" strokeWidth="2">
          <path d="M24 6C17 6 12 11 12 18v8l-3 5h30l-3-5v-8c0-7-5-12-12-12z" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M20 37a4 4 0 008 0" strokeLinecap="round"/>
        </svg>
      ),
    },
  ],
  store_manager: [
    {
      label: "Reports",
      description: "Generate and download store reports",
      icon: (
        <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" stroke="currentColor" strokeWidth="2">
          <rect x="8" y="6" width="32" height="38" rx="3" strokeLinecap="round"/>
          <path d="M16 18h16M16 26h16M16 34h10" strokeLinecap="round"/>
        </svg>
      ),
    },
  ],
  administrator: [
    {
      label: "Manage Accounts",
      description: "Create and manage staff accounts",
      route: "/manage-accounts",
      icon: (
        <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" stroke="currentColor" strokeWidth="2">
          <circle cx="20" cy="16" r="7" strokeLinecap="round"/>
          <path d="M6 40c0-8 6-13 14-13" strokeLinecap="round"/>
          <path d="M32 28v12M26 34h12" strokeLinecap="round"/>
        </svg>
      ),
    },
  ],
};

function getTilesForUser(rights: string) {
  const supervisor = tilesByRole.store_supervisor;
  const manager    = tilesByRole.store_manager;
  const admin      = tilesByRole.administrator;

  if (rights === "administrator") return [...supervisor, ...manager, ...admin];
  if (rights === "store_manager") return [...supervisor, ...manager];
  return supervisor; // store_supervisor
}

export default function UserDashboard() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<StoreUser | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("sfr_user_token");
    const raw   = localStorage.getItem("sfr_user");
    if (!token || !raw) {
      setLocation("/user-signin");
      return;
    }
    try {
      setUser(JSON.parse(raw));
    } catch {
      setLocation("/user-signin");
    }
  }, [setLocation]);

  const handleLogout = () => {
    localStorage.removeItem("sfr_user_token");
    localStorage.removeItem("sfr_user");
    setLocation("/user-signin");
  };

  if (!user) return null;

  const tiles = getTilesForUser(user.rights);

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: "#1e3f7a" }}>

      {/* Top bar */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 72 72" fill="none" className="w-9 h-9">
            <path
              d="M36 9C32.134 9 29 12.134 29 16C29 19.076 30.981 21.685 33.749 22.643C34.065 23.131 34.463 23.683 34.966 24.344C29.244 26.685 9 35.5 9 46H63C63 35.5 42.756 26.685 37.034 24.344C37.537 23.683 37.935 23.131 38.251 22.643C41.019 21.685 43 19.076 43 16C43 12.134 39.866 9 36 9Z"
              stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
            />
            <rect x="30" y="15" width="12" height="8" rx="1.5" fill="white" opacity="0.95"/>
            <line x1="16" y1="46" x2="16" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="56" y1="46" x2="56" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
          </svg>
          <span className="text-white font-semibold text-sm tracking-wide">Smart Fitting Room</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-white text-sm font-medium">{user.forenames} {user.surname}</p>
            <p className="text-white/50 text-xs">{rightsLabel[user.rights] ?? user.rights} · Branch {user.branchCode}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-white/60 hover:text-white border border-white/20 rounded-lg px-3 py-1.5 transition"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col px-8 pt-10 pb-12">
        <div className="max-w-3xl w-full mx-auto">
          <h1 className="text-white text-3xl font-bold mb-1">
            Welcome, {user.forenames}!
          </h1>
          <p className="text-white/50 text-sm mb-10">
            Select an option below to get started.
          </p>

          <div className={`grid gap-5 ${tiles.length <= 2 ? "grid-cols-2" : tiles.length === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
            {tiles.map((tile) => (
              <button
                key={tile.label}
                onClick={() => tile.route && setLocation(tile.route)}
                className="group rounded-2xl flex flex-col items-center justify-center gap-3 py-8 px-4 text-center transition"
                style={{ backgroundColor: "rgba(255,255,255,0.09)", cursor: tile.route ? "pointer" : "default" }}
                onMouseEnter={(e) => { if (tile.route) (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.16)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.09)"; }}
              >
                <span className="text-white/80 group-hover:text-white transition">
                  {tile.icon}
                </span>
                <div>
                  <p className="text-white font-semibold text-sm">{tile.label}</p>
                  <p className="text-white/45 text-xs mt-0.5 leading-snug">{tile.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
