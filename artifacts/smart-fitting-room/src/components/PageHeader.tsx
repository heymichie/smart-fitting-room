import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface PageHeaderProps {
  title: string;
  breadcrumb: string;
}

const BREADCRUMB_PATHS: Record<string, string> = {
  "Home": "/dashboard",
  "Manage Account": "/manage-accounts",
  "Create Account": "/create-account",
};

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

export default function PageHeader({ title, breadcrumb }: PageHeaderProps) {
  const [, setLocation] = useLocation();
  const now = useLiveClock();

  const handleLogout = () => {
    localStorage.removeItem("sfr_admin_token");
    localStorage.removeItem("sfr_admin_user");
    setLocation("/login");
  };

  return (
    <header className="flex items-start justify-between px-8 pt-6 pb-2">
      {/* Left: hanger home button + title */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setLocation("/dashboard")}
          className="shrink-0 opacity-90 hover:opacity-100 transition hover:scale-105 active:scale-95"
          title="Go to Home"
        >
          <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14">
            <path
              d="M36 6C31.582 6 28 9.582 28 14C28 17.535 30.166 20.553 33.249 21.767C33.595 22.298 34.048 22.911 34.621 23.641C28.292 26.289 6 36.5 6 50H66C66 36.5 43.708 26.289 37.379 23.641C37.952 22.911 38.405 22.298 38.751 21.767C41.834 20.553 44 17.535 44 14C44 9.582 40.418 6 36 6Z"
              stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
            />
            <rect x="29" y="13" width="14" height="9" rx="2" fill="white" opacity="0.95" />
            <line x1="14" y1="50" x2="14" y2="63" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="58" y1="50" x2="58" y2="63" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        </button>
        <div>
          <h1 className="text-white font-bold leading-tight" style={{ fontSize: "clamp(1.6rem, 4vw, 2.6rem)" }}>
            {title}
          </h1>
          <p className="text-white/60 text-sm mt-0.5">
            {breadcrumb.split("/").map((segment, i, arr) => {
              const isLast = i === arr.length - 1;
              const path = BREADCRUMB_PATHS[segment.trim()];
              return (
                <span key={i}>
                  {i > 0 && <span className="mx-1 opacity-50">/</span>}
                  {!isLast && path ? (
                    <button
                      onClick={() => setLocation(path)}
                      className="hover:text-white underline underline-offset-2 transition"
                    >
                      {segment.trim()}
                    </button>
                  ) : (
                    <span>{segment.trim()}</span>
                  )}
                </span>
              );
            })}
          </p>
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
  );
}
