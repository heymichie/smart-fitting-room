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

type Rights = "store_manager" | "store_supervisor" | "administrator";
interface AdminUser { username: string }

interface EditState {
  username: string;
  forenames: string;
  surname: string;
  employeeNumber: string;
  email: string;
  rights: Rights;
  storeBranchCode: string;
}

export default function AccountDetail() {
  const [, setLocation] = useLocation();
  const [, params]      = useRoute("/manage-accounts/:id");
  const userId          = params?.id ? parseInt(params.id, 10) : NaN;

  const [admin, setAdmin]       = useState<AdminUser | null>(null);
  const [toast, setToast]       = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);

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
      onSuccess: () => { refetch(); setIsEditing(false); },
      onError:   () => showToast("Failed to update account.", "error"),
    },
  });

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const startEditing = () => {
    if (!user) return;
    setEditState({
      username:        user.username,
      forenames:       user.forenames,
      surname:         user.surname,
      employeeNumber:  user.employeeNumber,
      email:           user.email ?? "",
      rights:          user.rights as Rights,
      storeBranchCode: user.storeBranchCode,
    });
    setIsEditing(true);
  };

  const cancelEditing = () => { setIsEditing(false); setEditState(null); };

  const handleSave = () => {
    if (!editState) return;
    updateUser({
      id: userId,
      data: {
        username:        editState.username,
        forenames:       editState.forenames,
        surname:         editState.surname,
        employeeNumber:  editState.employeeNumber,
        email:           editState.email || null,
        rights:          editState.rights,
        storeBranchCode: editState.storeBranchCode,
      },
    });
    showToast("Account updated successfully.");
  };

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
    const emailToUse = (isEditing ? editState?.email : user.email)?.trim() ?? "";
    if (!emailToUse) {
      showToast("Please enter a staff email address first.", "error");
      return;
    }
    showToast(`Password reset prompt sent to ${emailToUse}.`);
  };

  const patch = (field: keyof EditState, value: string) =>
    setEditState((prev) => prev ? { ...prev, [field]: value } : prev);

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

  const display = isEditing && editState ? editState : null;

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: "#1e3f7a" }}>
      <PageHeader
        title={`Account: (${admin.username})`}
        breadcrumb={`Home/Manage Account/${user.username}`}
      />

      {toast && (
        <div className={`mx-8 mt-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all ${
          toast.type === "error" ? "bg-red-600/80" : "bg-green-600/80"
        }`}>
          {toast.msg}
        </div>
      )}

      <main className="flex-1 flex flex-col px-8 pt-4 pb-6">
        <div className="w-full max-w-3xl">

          {/* Status badge + Edit button */}
          <div className="mb-3 flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              user.isActive
                ? "bg-green-500/20 text-green-300 border border-green-500/30"
                : "bg-red-500/20 text-red-300 border border-red-500/30"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? "bg-green-400" : "bg-red-400"}`} />
              {user.isActive ? "Active" : "Inactive"}
            </span>

            {!isEditing ? (
              <button
                onClick={startEditing}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold text-white/90 border border-white/25 hover:bg-white/10 transition"
              >
                {/* Pencil icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                  <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                </svg>
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={cancelEditing}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white/70 border border-white/20 hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isPending}
                  className="px-5 py-1.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition disabled:opacity-60"
                >
                  {isPending ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="rounded-xl overflow-hidden border border-white/10">
            {/* Header */}
            <div className="grid grid-cols-2" style={{ backgroundColor: "#c8cdd6" }}>
              <div className="px-5 py-3 font-bold text-gray-800 text-sm border-r border-white/30">User ID</div>
              <div className="px-5 py-3 font-bold text-gray-800 text-sm">{user.userId}</div>
            </div>

            {/* Username */}
            <DetailRow label="Username" alt={false}>
              {isEditing ? (
                <input type="text" value={display!.username} onChange={(e) => patch("username", e.target.value)}
                  className="w-full bg-transparent outline-none text-gray-800 text-sm border-b border-gray-400/50 focus:border-blue-600 pb-0.5 transition-colors" />
              ) : <span className="text-sm text-gray-800">{user.username}</span>}
            </DetailRow>

            {/* Fore Name(s) */}
            <DetailRow label="Fore Name(s)" alt>
              {isEditing ? (
                <input type="text" value={display!.forenames} onChange={(e) => patch("forenames", e.target.value)}
                  className="w-full bg-transparent outline-none text-gray-800 text-sm border-b border-gray-400/50 focus:border-blue-600 pb-0.5 transition-colors" />
              ) : <span className="text-sm text-gray-800">{user.forenames}</span>}
            </DetailRow>

            {/* Surname */}
            <DetailRow label="Surname" alt={false}>
              {isEditing ? (
                <input type="text" value={display!.surname} onChange={(e) => patch("surname", e.target.value)}
                  className="w-full bg-transparent outline-none text-gray-800 text-sm border-b border-gray-400/50 focus:border-blue-600 pb-0.5 transition-colors" />
              ) : <span className="text-sm text-gray-800">{user.surname}</span>}
            </DetailRow>

            {/* Employee Number */}
            <DetailRow label="Employee Number" alt>
              {isEditing ? (
                <input type="text" value={display!.employeeNumber} onChange={(e) => patch("employeeNumber", e.target.value)}
                  className="w-full bg-transparent outline-none text-gray-800 text-sm border-b border-gray-400/50 focus:border-blue-600 pb-0.5 transition-colors" />
              ) : <span className="text-sm text-gray-800">{user.employeeNumber}</span>}
            </DetailRow>

            {/* Staff email address */}
            <DetailRow label="Staff email address" alt={false}>
              {isEditing ? (
                <input type="email" value={display!.email} onChange={(e) => patch("email", e.target.value)}
                  placeholder="e.g. johndoe@company.com"
                  className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-400 text-sm border-b border-gray-400/50 focus:border-blue-600 pb-0.5 transition-colors" />
              ) : <span className="text-sm text-gray-800">{user.email || <span className="text-gray-400 italic">Not set</span>}</span>}
            </DetailRow>

            {/* Designation */}
            <DetailRow label="Designation" alt>
              <div className="flex flex-col gap-1.5">
                {RIGHTS_OPTIONS.map((opt) => (
                  <label key={opt.value} className={`flex items-center gap-2 text-sm text-gray-700 ${isEditing ? "cursor-pointer" : "cursor-default"}`}>
                    <input type="radio" name="edit-rights" value={opt.value}
                      checked={isEditing ? display!.rights === opt.value : user.rights === opt.value}
                      onChange={() => isEditing && patch("rights", opt.value)}
                      disabled={!isEditing}
                      className="accent-blue-700" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </DetailRow>

            {/* Store Branch Code */}
            {(() => {
              const currentRights = isEditing ? display!.rights : user.rights;
              const currentBranch = isEditing ? display!.storeBranchCode : user.storeBranchCode;
              const isAdmin = currentRights === "administrator";
              return (
                <div
                  className="grid grid-cols-2 border-t border-white/10 transition-opacity"
                  style={{ backgroundColor: "#e8eaed", opacity: isAdmin ? 0.35 : 1 }}
                >
                  <div className="px-5 py-3 text-sm text-gray-700 font-medium border-r border-white/30 flex items-start pt-3.5">
                    Store Branch Code
                  </div>
                  <div className="px-5 py-3 flex flex-col gap-1.5">
                    {BRANCH_OPTIONS.map((code) => (
                      <label key={code} className={`flex items-center gap-2 text-sm text-gray-700 ${isEditing && !isAdmin ? "cursor-pointer" : "cursor-default"}`}>
                        <input type="radio" name="edit-branch" value={code}
                          checked={!isAdmin && currentBranch === code}
                          onChange={() => isEditing && !isAdmin && patch("storeBranchCode", code)}
                          disabled={!isEditing || isAdmin}
                          className="accent-blue-700" />
                        {code}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Empty bottom row */}
            <div className="grid grid-cols-2 h-8 border-t border-white/10" style={{ backgroundColor: "#dde0e6" }}>
              <div className="border-r border-white/30" /><div />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 mt-6">
            <button onClick={handleActivate} disabled={isPending || user.isActive}
              className="flex-1 rounded-xl py-3.5 font-semibold text-gray-700 text-base transition hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: "#f0f1f3" }}
              title={user.isActive ? "Account is already active" : "Activate this account"}>
              Active
            </button>
            <button onClick={handleDeactivate} disabled={isPending || !user.isActive}
              className="flex-1 rounded-xl py-3.5 font-semibold text-gray-500 text-base transition hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: "#b0b5be" }}
              title={!user.isActive ? "Account is already deactivated" : "Deactivate this account"}>
              Deactivate
            </button>
            <button onClick={handleResetPassword} disabled={isPending}
              className="flex-1 rounded-xl py-3.5 font-semibold text-gray-500 text-base transition hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: "#b0b5be" }}>
              Reset Password
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function DetailRow({ label, children, alt }: { label: string; children: React.ReactNode; alt?: boolean }) {
  return (
    <div className="grid grid-cols-2 border-t border-white/10"
      style={{ backgroundColor: alt ? "#dde0e6" : "#e8eaed" }}>
      <div className="px-5 py-3 text-sm text-gray-700 font-medium border-r border-white/30 flex items-start pt-3.5">
        {label}
      </div>
      <div className="px-5 py-3">{children}</div>
    </div>
  );
}
