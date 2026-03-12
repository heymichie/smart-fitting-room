import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface AdminUser {
  username: string;
  organisationTradingName: string;
  administratorForenames: string;
  surname: string;
  designation: string;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [admin, setAdmin] = useState<AdminUser | null>(null);

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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="bg-[#1a3a6b] text-white px-8 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white">
            <path d="M36 9C32.134 9 29 12.134 29 16C29 19.076 30.981 21.685 33.749 22.643C34.065 23.131 34.463 23.683 34.966 24.344C29.244 26.685 9 35.5 9 46H63C63 35.5 42.756 26.685 37.034 24.344C37.537 23.683 37.935 23.131 38.251 22.643C41.019 21.685 43 19.076 43 16C43 12.134 39.866 9 36 9Z" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="30" y="15" width="12" height="8" rx="1.5" fill="white" opacity="0.95" />
            <line x1="16" y1="46" x2="16" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="56" y1="46" x2="56" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
          <span className="font-semibold text-lg">Smart Fitting Room</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/80 text-sm">
            {admin.administratorForenames} {admin.surname} &mdash; {admin.designation}
          </span>
          <button
            onClick={handleLogout}
            className="text-white/70 hover:text-white text-sm border border-white/30 hover:border-white/60 rounded-lg px-3 py-1.5 transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold text-foreground">
          Welcome, {admin.administratorForenames}!
        </h1>
        <p className="text-muted-foreground text-center max-w-md">
          You are logged in as the administrator for <strong>{admin.organisationTradingName}</strong>.
          The dashboard is being built — more features coming soon.
        </p>
      </main>
    </div>
  );
}
