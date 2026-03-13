import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/[^/]*$/, "") + "/api";

interface AdminUser { username: string; }

interface RightsSettings {
  smRespondAlert:         boolean;
  smOpenDoor:             boolean;
  smClearEntrance:        boolean;
  smSpoolReports:         boolean;
  ssRespondAlert:         boolean;
  ssOpenDoor:             boolean;
  ssClearEntrance:        boolean;
  ssSpoolReports:         boolean;
  adminCreateAccounts:    boolean;
  adminSetupFittingRooms: boolean;
  adminSpoolReports:      boolean;
}

const DEFAULT_SETTINGS: RightsSettings = {
  smRespondAlert: true, smOpenDoor: true, smClearEntrance: true, smSpoolReports: true,
  ssRespondAlert: true, ssOpenDoor: true, ssClearEntrance: true, ssSpoolReports: true,
  adminCreateAccounts: true, adminSetupFittingRooms: true, adminSpoolReports: true,
};

interface PermissionRow {
  label:   string;
  smKey?:  keyof RightsSettings;
  ssKey?:  keyof RightsSettings;
  adKey?:  keyof RightsSettings;
}

const PERMISSION_ROWS: PermissionRow[] = [
  { label: "Respond to fitting room alert", smKey: "smRespondAlert",         ssKey: "ssRespondAlert"   },
  { label: "Open Fitting Room Door",        smKey: "smOpenDoor",              ssKey: "ssOpenDoor"       },
  { label: "Clear main entrance alert",     smKey: "smClearEntrance",         ssKey: "ssClearEntrance"  },
  { label: "Spool Reports",                 smKey: "smSpoolReports",          ssKey: "ssSpoolReports",  adKey: "adminSpoolReports"      },
  { label: "Create New Accounts",                                                                        adKey: "adminCreateAccounts"    },
  { label: "Setup branch fitting rooms",                                                                 adKey: "adminSetupFittingRooms" },
];

export default function UserRights() {
  const [, setLocation]                 = useLocation();
  const [admin, setAdmin]               = useState<AdminUser | null>(null);
  const [settings, setSettings]         = useState<RightsSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading]       = useState(true);
  const [isSaving, setIsSaving]         = useState(false);
  const { toast }                       = useToast();

  useEffect(() => {
    const token   = localStorage.getItem("sfr_admin_token");
    const userStr = localStorage.getItem("sfr_admin_user");
    if (!token || !userStr) { setLocation("/login"); return; }
    try { setAdmin(JSON.parse(userStr)); } catch { setLocation("/login"); }
  }, [setLocation]);

  useEffect(() => {
    if (!admin) return;
    const token = localStorage.getItem("sfr_admin_token");
    fetch(`${API_BASE}/rights-settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setSettings({ ...DEFAULT_SETTINGS, ...data }); })
      .catch(() => { /* use defaults */ })
      .finally(() => setIsLoading(false));
  }, [admin]);

  const toggle = (key: keyof RightsSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const save = async (andNavigate?: boolean) => {
    setIsSaving(true);
    const token = localStorage.getItem("sfr_admin_token");
    try {
      const res = await fetch(`${API_BASE}/rights-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Rights saved", description: "User rights updated successfully." });
      if (andNavigate) setLocation("/dashboard");
    } catch {
      toast({ title: "Error", description: "Failed to save rights.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!admin) return null;

  const COL_HEADER = "text-white font-bold text-base px-6 py-4 border-r border-white/20 last:border-r-0";
  const CELL = "flex items-center gap-3 px-6 py-3 border-r border-white/20 last:border-r-0";

  const Checkbox = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className="w-5 h-5 shrink-0 border-2 border-gray-400 rounded flex items-center justify-center transition hover:border-gray-600"
      style={{ backgroundColor: checked ? "#1e3f7a" : "#fff" }}
      aria-checked={checked}
      role="checkbox"
    >
      {checked && (
        <svg viewBox="0 0 12 10" fill="none" className="w-3 h-3">
          <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: "#1e3f7a" }}>
      <PageHeader title={`Account: (${admin.username})`} breadcrumb="Home/User Rights" />

      <main className="flex-1 flex flex-col px-8 pt-4 pb-8">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-white/60 text-sm">Loading…</div>
        ) : (
          <>
            <div className="w-full rounded-xl overflow-hidden border border-white/10">
              {/* Header */}
              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", backgroundColor: "#111827" }}>
                {["Store Manager", "Store Supervisor", "Administrator"].map(h => (
                  <div key={h} className={COL_HEADER}>{h}</div>
                ))}
              </div>

              {/* Rows */}
              {PERMISSION_ROWS.map((row, idx) => (
                <div
                  key={row.label}
                  className="grid border-t border-white/10"
                  style={{
                    gridTemplateColumns: "1fr 1fr 1fr",
                    backgroundColor: idx % 2 === 0 ? "#e8eaed" : "#d8dbe2",
                  }}
                >
                  {/* Store Manager */}
                  <div className={CELL}>
                    {row.smKey ? (
                      <>
                        <Checkbox checked={settings[row.smKey] as boolean} onChange={() => toggle(row.smKey!)} />
                        <span className="text-sm text-gray-800">{row.label}</span>
                      </>
                    ) : <span />}
                  </div>

                  {/* Store Supervisor */}
                  <div className={CELL}>
                    {row.ssKey ? (
                      <>
                        <Checkbox checked={settings[row.ssKey] as boolean} onChange={() => toggle(row.ssKey!)} />
                        <span className="text-sm text-gray-800">{row.label}</span>
                      </>
                    ) : <span />}
                  </div>

                  {/* Administrator */}
                  <div className={CELL}>
                    {row.adKey ? (
                      <>
                        <Checkbox checked={settings[row.adKey] as boolean} onChange={() => toggle(row.adKey!)} />
                        <span className="text-sm text-gray-800">{row.label}</span>
                      </>
                    ) : <span />}
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-6 mt-8 justify-center">
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
          </>
        )}
      </main>
    </div>
  );
}
