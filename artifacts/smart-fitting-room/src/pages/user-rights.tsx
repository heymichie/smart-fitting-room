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

const DEFAULT: RightsSettings = {
  smRespondAlert: true, smOpenDoor: true, smClearEntrance: true, smSpoolReports: true,
  ssRespondAlert: true, ssOpenDoor: true, ssClearEntrance: true, ssSpoolReports: true,
  adminCreateAccounts: true, adminSetupFittingRooms: true, adminSpoolReports: true,
};

type Key = keyof RightsSettings;

interface Row {
  label: string;
  sm:    Key | null;
  ss:    Key | null;
  ad:    Key | null;
}

const ROWS: Row[] = [
  { label: "Respond to fitting room alert", sm: "smRespondAlert",         ss: "ssRespondAlert",  ad: null                      },
  { label: "Open Fitting Room Door",        sm: "smOpenDoor",              ss: "ssOpenDoor",       ad: null                      },
  { label: "Clear main entrance alert",     sm: "smClearEntrance",         ss: "ssClearEntrance",  ad: null                      },
  { label: "Spool Reports",                 sm: "smSpoolReports",          ss: "ssSpoolReports",   ad: "adminSpoolReports"       },
  { label: "Create New Accounts",           sm: null,                      ss: null,               ad: "adminCreateAccounts"     },
  { label: "Setup branch fitting rooms",    sm: null,                      ss: null,               ad: "adminSetupFittingRooms"  },
];

const ROLES = [
  { label: "Store Manager",   col: "sm" as const },
  { label: "Store Supervisor",col: "ss" as const },
  { label: "Administrator",   col: "ad" as const },
];

function Checkbox({
  checked, applicable, onChange,
}: { checked: boolean; applicable: boolean; onChange: () => void }) {
  return (
    <button
      onClick={applicable ? onChange : undefined}
      disabled={!applicable}
      aria-checked={applicable ? checked : undefined}
      role="checkbox"
      className="w-5 h-5 rounded border-2 flex items-center justify-center transition shrink-0"
      style={{
        backgroundColor: !applicable ? "transparent" : checked ? "#1e3f7a" : "#fff",
        borderColor:     !applicable ? "#bbb" : checked ? "#1e3f7a" : "#888",
        opacity:         !applicable ? 0.3 : 1,
        cursor:          !applicable ? "not-allowed" : "pointer",
      }}
    >
      {applicable && checked && (
        <svg viewBox="0 0 12 10" fill="none" className="w-3 h-3">
          <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export default function UserRights() {
  const [, setLocation]           = useLocation();
  const [admin, setAdmin]         = useState<AdminUser | null>(null);
  const [settings, setSettings]   = useState<RightsSettings>(DEFAULT);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving]   = useState(false);
  const { toast }                 = useToast();

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
      .then(d => setSettings({ ...DEFAULT, ...d }))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [admin]);

  const toggle = (key: Key) => setSettings(p => ({ ...p, [key]: !p[key] }));

  const save = async (navigate: boolean) => {
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
      if (navigate) setLocation("/dashboard");
    } catch {
      toast({ title: "Error", description: "Failed to save rights.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!admin) return null;

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: "#1e3f7a" }}>
      <PageHeader title={`Account: (${admin.username})`} breadcrumb="Home/User Rights" />

      <main className="flex-1 flex flex-col px-8 pt-4 pb-8">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-white/60 text-sm">Loading…</div>
        ) : (
          <>
            <div className="w-full rounded-xl overflow-hidden border border-white/10">
              {/* Header row */}
              <div
                className="grid text-white font-bold text-sm"
                style={{ backgroundColor: "#111827", gridTemplateColumns: "2fr 1fr 1fr 1fr" }}
              >
                <div className="flex items-center px-5 py-3 border-r border-white/10">Function</div>
                {ROLES.map(r => (
                  <div key={r.label} className="flex items-center justify-center px-3 py-3 border-r border-white/10 last:border-r-0 text-center">
                    {r.label}
                  </div>
                ))}
              </div>

              {/* Permission rows */}
              {ROWS.map((row, idx) => (
                <div
                  key={row.label}
                  className="grid border-t border-white/10 items-center"
                  style={{
                    gridTemplateColumns: "2fr 1fr 1fr 1fr",
                    backgroundColor: idx % 2 === 0 ? "#e8eaed" : "#d8dbe2",
                  }}
                >
                  {/* Function label */}
                  <div className="flex items-center px-5 py-3 text-sm font-medium text-gray-800 border-r border-white/20">
                    {row.label}
                  </div>

                  {/* Store Manager */}
                  <div className="flex items-center justify-center px-3 py-3 border-r border-white/20">
                    <Checkbox
                      applicable={row.sm !== null}
                      checked={row.sm !== null ? settings[row.sm] : false}
                      onChange={() => row.sm && toggle(row.sm)}
                    />
                  </div>

                  {/* Store Supervisor */}
                  <div className="flex items-center justify-center px-3 py-3 border-r border-white/20">
                    <Checkbox
                      applicable={row.ss !== null}
                      checked={row.ss !== null ? settings[row.ss] : false}
                      onChange={() => row.ss && toggle(row.ss)}
                    />
                  </div>

                  {/* Administrator */}
                  <div className="flex items-center justify-center px-3 py-3">
                    <Checkbox
                      applicable={row.ad !== null}
                      checked={row.ad !== null ? settings[row.ad] : false}
                      onChange={() => row.ad && toggle(row.ad)}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Buttons */}
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
