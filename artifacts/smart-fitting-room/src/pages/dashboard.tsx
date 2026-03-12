import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import PageHeader from "@/components/PageHeader";

interface AdminUser {
  username: string;
  organisationTradingName: string;
  administratorForenames: string;
  surname: string;
  designation: string;
}

const menuItems = [
  { label: "Create New Account",  path: "/create-account" },
  { label: "Manage Accounts",     path: "/manage-accounts" },
  { label: "Reports",             path: "/reports" },
  { label: "User Rights",         path: "/user-rights" },
  { label: "Setup Fitting Rooms", path: "/setup-fitting-rooms" },
];

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

  if (!admin) return null;

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: "#1e3f7a" }}>
      <PageHeader
        title={`Welcome (${admin.username})`}
        breadcrumb="Home/Administrator"
      />

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
