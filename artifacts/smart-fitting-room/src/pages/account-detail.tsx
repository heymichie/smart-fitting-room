import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useGetUser, useUpdateUser } from "@workspace/api-client-react";
import PageHeader from "@/components/PageHeader";

const RIGHTS_OPTIONS = [
  { value: "store_manager",    label: "Store Manager" },
  { value: "store_supervisor", label: "Store Supervisor" },
  { value: "administrator",    label: "Administrator" },
] as const;

const BRANCH_OPTIONS = ["501", "511", "502"];

interface AdminUser { username: string }

export default function AccountDetail() {
  const [, setLocation] = useLocation();
  const [, params]      = useRoute("/manage-accounts/:id");
  const userId          = params?.id ? parseInt(params.id, 10) : NaN;

  const [admin, setAdmin]     = useState<AdminUser | null>(null);
  const [toast, setToast]     = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const token   = localStorage.getItem("sfr_admin_token");
    const userStr = localStorage.getItem("sfr_admin_user");
    if (!token || !userStr) { setLocation("/login"); return; }
    try { setAdmin(JSON.parse(userStr)); } catch { setLocation("/login"); }
  }, [setLocation]);

  const { data: user, isLoading, error, refetch } = useGetUser(
    isNaN(userId) ? 0 : userId,
    { query: { enabled: !!admin && !isNaN(userId) } }
  );

  const { mutate: updateUser, isPending } = useUpdateUser({
    mutation: {
      onSuccess: () => { refetch(); },
      onError:   () => showToast("Failed to update account.", "error"),
    },
  });

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const handleActivate = () => {
    if (!user || user.isActive) return;
    updateUser({ id: userId, data: { isActive: true } });
    showToast("Account activated successfully.");
  };

  const handleDeactivate = () => {
    if (!user || !user.isActive) return;
    updateUser({ id: userId, data: { isActive: false } });
    showToast("Account deactivated successfully.");
  };

  const handleResetPassword = () => {
    if (!user) return;
    if (!user.email) {
      showToast("No email address on file for this account.", "error");
      return;
    }
    showToast(`Password reset prompt sent to ${user.email}.`);
  };

  if (!admin) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#1e3f7a" }}>
        <span className="text-white/60 text-lg">Loading…</span>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: "#1e3f7a" }}>
        <span className="text-white text-lg">Account not found.</span>
        <button onClick={() => setLocation("/manage-accounts")} className="text-white/60 underline text-sm">
          Back to Manage Accounts
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: "#1e3f7a" }}>
      <PageHeader
        title={`Account: (${admin.username})`}
        breadcrumb={`Home/Manage Account/${user.username}`}
      />

      {/* Toast */}
      {toast && (
        <div
          className={`mx-8 mt-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all ${
            toast.type === "error" ? "bg-red-600/80" : "bg-green-600/80"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <main className="flex-1 flex flex-col px-8 pt-4 pb-6">
        <div className="w-full max-w-3xl">

          {/* Status badge */}
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                user.isActive
                  ? "bg-green-500/20 text-green-300 border border-green-500/30"
                  : "bg-red-500/20 text-red-300 border border-red-500/30"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? "bg-green-400" : "bg-red-400"}`} />
              {user.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          {/* Table */}
          <div className="rounded-xl overflow-hidden border border-white/10">
            {/* Header */}
            <div className="grid grid-cols-2" style={{ backgroundColor: "#c8cdd6" }}>
              <div className="px-5 py-3 font-bold text-gray-800 text-sm border-r border-white/30">User ID</div>
              <div className="px-5 py-3 font-bold text-gray-800 text-sm">{user.userId}</div>
            </div>

            <ReadRow label="Username"        value={user.username} />
            <ReadRow label="Fore Name(s)"    value={user.forenames} alt />
            <ReadRow label="Surname"         value={user.surname} />
            <ReadRow label="Employee Number" value={user.employeeNumber} alt />
            {user.email && <ReadRow label="Email" value={user.email} />}

            {/* Designation */}
            <div
              className="grid grid-cols-2 border-t border-white/10"
              style={{ backgroundColor: user.email ? "#dde0e6" : "#e8eaed" }}
            >
              <div className="px-5 py-3 text-sm text-gray-700 font-medium border-r border-white/30 flex items-start pt-3.5">
                Designation
              </div>
              <div className="px-5 py-3 flex flex-col gap-1.5">
                {RIGHTS_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-default">
                    <input
                      type="radio"
                      readOnly
                      disabled
                      checked={user.rights === opt.value}
                      className="accent-blue-700"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Store Branch Code */}
            <div
              className="grid grid-cols-2 border-t border-white/10"
              style={{ backgroundColor: user.email ? "#e8eaed" : "#dde0e6" }}
            >
              <div className="px-5 py-3 text-sm text-gray-700 font-medium border-r border-white/30 flex items-start pt-3.5">
                Store Branch Code
              </div>
              <div className="px-5 py-3 flex flex-col gap-1.5">
                {(user.rights === "administrator"
                  ? [...BRANCH_OPTIONS, "ALL"]
                  : BRANCH_OPTIONS
                ).map((code) => (
                  <label key={code} className="flex items-center gap-2 text-sm text-gray-700 cursor-default">
                    <input
                      type="radio"
                      readOnly
                      disabled
                      checked={
                        user.rights === "administrator"
                          ? code === "ALL"
                          : user.storeBranchCode === code
                      }
                      className="accent-blue-700"
                    />
                    {code}
                  </label>
                ))}
              </div>
            </div>

            {/* Empty bottom row */}
            <div className="grid grid-cols-2 h-8 border-t border-white/10" style={{ backgroundColor: "#e8eaed" }}>
              <div className="border-r border-white/30" />
              <div />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={handleActivate}
              disabled={isPending || user.isActive}
              className="flex-1 rounded-xl py-3.5 font-semibold text-gray-700 text-base transition hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: "#f0f1f3" }}
              title={user.isActive ? "Account is already active" : "Activate this account"}
            >
              Active
            </button>
            <button
              onClick={handleDeactivate}
              disabled={isPending || !user.isActive}
              className="flex-1 rounded-xl py-3.5 font-semibold text-gray-500 text-base transition hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: "#b0b5be" }}
              title={!user.isActive ? "Account is already deactivated" : "Deactivate this account"}
            >
              Deactivate
            </button>
            <button
              onClick={handleResetPassword}
              disabled={isPending}
              className="flex-1 rounded-xl py-3.5 font-semibold text-gray-500 text-base transition hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: "#b0b5be" }}
            >
              Reset Password
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function ReadRow({ label, value, alt }: { label: string; value: string; alt?: boolean }) {
  return (
    <div
      className="grid grid-cols-2 border-t border-white/10"
      style={{ backgroundColor: alt ? "#dde0e6" : "#e8eaed" }}
    >
      <div className="px-5 py-3 text-sm text-gray-700 font-medium border-r border-white/30">{label}</div>
      <div className="px-5 py-3 text-sm text-gray-800">{value}</div>
    </div>
  );
}
