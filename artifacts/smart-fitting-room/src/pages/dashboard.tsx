import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface AdminUser {
  username: string;
  organisationTradingName: string;
  administratorForenames: string;
  surname: string;
  designation: string;
}

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatDate(d: Date) {
  const day = String(d.getDate()).padStart(2, "0");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const month = months[d.getMonth()];
  const year = String(d.getFullYear()).slice(2);
  return `${day}-${month}-${year}`;
}

function formatTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
}

const menuItems = [
  { label: "Create New Account", path: "/create-account" },
  { label: "Manage Accounts",    path: "/manage-accounts" },
  { label: "Reports",            path: "/reports" },
  { label: "User Rights",        path: "/user-rights" },
  { label: "Setup Fitting Rooms",path: "/setup-fitting-rooms" },
];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const now = useLiveClock();

  useEffect(() => {
    const token = localStorage.getItem("sfr_admin_token");
    const userStr = localStorage.getItem("sfr_admin_user");
    if (!token || !userStr) {
      setLocation("/login");
      return;
    }
    try {
      setAdmin(JSON.parse(userStr));
    } catch {
      setLocation("/login");
    }
  }, [setLocation]);

  const handleLogout = () => {
    localStorage.removeItem("sfr_admin_token");
    localStorage.removeItem("sfr_admin_user");
    setLocation("/login");
  };

  if (!admin) return null;

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ backgroundColor: "#1e3f7a" }}
    >
      {/* ── Header ── */}
      <header className="flex items-start justify-between px-8 pt-6 pb-2">
        {/* Left: icon + welcome */}
        <div className="flex items-center gap-4">
          {/* Hanger icon */}
          <svg
            viewBox="0 0 72 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-14 h-14 shrink-0"
          >
            <path
              d="M36 6C31.582 6 28 9.582 28 14C28 17.535 30.166 20.553 33.249 21.767C33.595 22.298 34.048 22.911 34.621 23.641C28.292 26.289 6 36.5 6 50H66C66 36.5 43.708 26.289 37.379 23.641C37.952 22.911 38.405 22.298 38.751 21.767C41.834 20.553 44 17.535 44 14C44 9.582 40.418 6 36 6Z"
              stroke="white"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Tag box */}
            <rect x="29" y="13" width="14" height="9" rx="2" fill="white" opacity="0.95" />
            {/* Bottom legs */}
            <line x1="14" y1="50" x2="14" y2="63" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="58" y1="50" x2="58" y2="63" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          </svg>

          <div>
            <h1 className="text-white font-bold leading-tight" style={{ fontSize: "clamp(1.6rem, 4vw, 2.6rem)" }}>
              Welcome ({admin.username})
            </h1>
            <p className="text-white/60 text-sm mt-0.5">Home/Administrator</p>
          </div>
        </div>

        {/* Right: logout + clock */}
        <div className="flex flex-col items-end gap-0.5 pt-1">
          <button
            onClick={handleLogout}
            className="text-white font-extrabold text-base tracking-widest hover:text-white/70 transition uppercase"
          >
            LOGOUT
          </button>
          <span className="text-white/70 text-sm">
            {formatDate(now)}: {formatTime(now)}
          </span>
        </div>
      </header>

      {/* ── Menu grid ── */}
      <main className="flex-1 flex items-center justify-center px-10 pb-10">
        <div className="w-full max-w-5xl grid grid-cols-3 gap-6">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setLocation(item.path)}
              className="rounded-2xl flex items-center justify-center text-center text-gray-700 font-semibold text-lg transition hover:brightness-95 active:scale-[0.98] shadow-sm"
              style={{
                backgroundColor: "#dde3ec",
                minHeight: "120px",
                padding: "2rem 1.5rem",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
