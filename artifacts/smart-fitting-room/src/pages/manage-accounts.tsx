import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useListUsers } from "@workspace/api-client-react";
import PageHeader from "@/components/PageHeader";

interface AdminUser {
  username: string;
}

function formatRights(rights: string) {
  switch (rights) {
    case "store_manager":    return "Store Manager";
    case "store_supervisor": return "Store Supervisor";
    case "administrator":    return "Administrator";
    default:                 return rights;
  }
}

function formatCreated(dateStr: string, createdBy?: string) {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const time = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  return createdBy
    ? `${createdBy}, ${day}-${month}-${year} ${time}`
    : `${day}-${month}-${year} ${time}`;
}

export default function ManageAccounts() {
  const [, setLocation] = useLocation();
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("sfr_admin_token");
    const userStr = localStorage.getItem("sfr_admin_user");
    if (!token || !userStr) { setLocation("/login"); return; }
    try { setAdmin(JSON.parse(userStr)); } catch { setLocation("/login"); }
  }, [setLocation]);

  const { data: users = [], isLoading, error } = useListUsers({
    query: { enabled: !!admin },
  });

  if (!admin) return null;

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: "#1e3f7a" }}>
      <PageHeader
        title={`Account: (${admin.username})`}
        breadcrumb="Home/Manage Account"
      />

      <main className="flex-1 flex flex-col px-8 pt-4 pb-8">
        <div className="w-full rounded-xl overflow-hidden border border-white/10">
          {/* Header row */}
          <div
            className="grid text-white font-bold text-sm"
            style={{
              backgroundColor: "#111827",
              gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 0.8fr 1.3fr",
            }}
          >
            {["Username","Full Name","Employee Number","Branch Code","User Rights","Status","Created"].map((col) => (
              <div key={col} className="flex items-center px-4 py-3 border-r border-white/10 last:border-r-0">
                {col}
              </div>
            ))}
          </div>

          {/* Body */}
          {isLoading && (
            <div className="py-10 text-center text-white/50 text-sm" style={{ backgroundColor: "#dde0e6" }}>
              Loading…
            </div>
          )}

          {error && (
            <div className="py-10 text-center text-red-600 text-sm" style={{ backgroundColor: "#dde0e6" }}>
              Failed to load accounts.
            </div>
          )}

          {!isLoading && !error && users.length === 0 && (
            <div className="py-10 text-center text-gray-500 text-sm" style={{ backgroundColor: "#dde0e6" }}>
              No accounts found. Create one from the dashboard.
            </div>
          )}

          {!isLoading && users.map((user, idx) => {
            const branchDisplay = user.rights === "administrator" ? "ALL" : user.storeBranchCode;
            return (
              <div
                key={user.id}
                className="grid items-center text-sm text-gray-800 border-t border-white/20 cursor-pointer hover:brightness-95 transition"
                style={{
                  backgroundColor: idx % 2 === 0 ? "#e8eaed" : "#d8dbe2",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 0.8fr 1.3fr",
                }}
                onClick={() => setLocation(`/manage-accounts/${user.id}`)}
              >
                <div className="flex items-center px-4 py-3 border-r border-white/20">{user.username}</div>
                <div className="flex items-center px-4 py-3 border-r border-white/20">{user.forenames} {user.surname}</div>
                <div className="flex items-center px-4 py-3 border-r border-white/20">{user.employeeNumber}</div>
                <div className="flex items-center px-4 py-3 border-r border-white/20">{branchDisplay}</div>
                <div className="flex items-center px-4 py-3 border-r border-white/20">{formatRights(user.rights)}</div>
                <div className="flex items-center px-4 py-3 border-r border-white/20">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: user.isActive ? "#dcfce7" : "#fee2e2",
                      color: user.isActive ? "#15803d" : "#b91c1c",
                    }}
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex items-center px-4 py-3 italic text-gray-600">
                  {formatCreated(user.createdAt, admin.username)}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
