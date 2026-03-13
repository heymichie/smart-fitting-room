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

export default function UserDashboard() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<StoreUser | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("sfr_user_token");
    const raw   = localStorage.getItem("sfr_user");
    if (!token || !raw) {
      setLocation("/user-login");
      return;
    }
    try {
      setUser(JSON.parse(raw));
    } catch {
      setLocation("/user-login");
    }
  }, [setLocation]);

  const handleLogout = () => {
    localStorage.removeItem("sfr_user_token");
    localStorage.removeItem("sfr_user");
    setLocation("/user-login");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: "#1e3f7a" }}>

      {/* Top bar */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-9">
            <path
              d="M36 9C32.134 9 29 12.134 29 16C29 19.076 30.981 21.685 33.749 22.643C34.065 23.131 34.463 23.683 34.966 24.344C29.244 26.685 9 35.5 9 46H63C63 35.5 42.756 26.685 37.034 24.344C37.537 23.683 37.935 23.131 38.251 22.643C41.019 21.685 43 19.076 43 16C43 12.134 39.866 9 36 9Z"
              stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
            />
            <rect x="30" y="15" width="12" height="8" rx="1.5" fill="white" opacity="0.95" />
            <line x1="16" y1="46" x2="16" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="56" y1="46" x2="56" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
          <span className="text-white font-semibold text-sm tracking-wide">Smart Fitting Room</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-white/70 text-sm">
            {user.forenames} {user.surname} &nbsp;·&nbsp; {rightsLabel[user.rights] ?? user.rights}
          </span>
          <button
            onClick={handleLogout}
            className="text-xs text-white/60 hover:text-white border border-white/20 rounded-lg px-3 py-1.5 transition"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 pb-12">
        <div className="text-center">
          <h1 className="text-white text-4xl font-bold mb-2">
            Welcome, {user.forenames}!
          </h1>
          <p className="text-white/60 text-sm mb-8">
            Branch: <span className="text-white/90 font-medium">{user.branchCode}</span>
            &nbsp;·&nbsp;
            {rightsLabel[user.rights] ?? user.rights}
          </p>

          {/* Placeholder tiles */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-xl mx-auto">
            {[
              { label: "Fitting Rooms",  icon: "🚪" },
              { label: "Alerts",         icon: "🔔" },
              { label: "Reports",        icon: "📊" },
            ].map(tile => (
              <div
                key={tile.label}
                className="rounded-2xl flex flex-col items-center justify-center gap-2 py-8 cursor-pointer hover:bg-white/20 transition"
                style={{ backgroundColor: "rgba(255,255,255,0.10)" }}
              >
                <span className="text-4xl">{tile.icon}</span>
                <span className="text-white text-sm font-medium">{tile.label}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

    </div>
  );
}
