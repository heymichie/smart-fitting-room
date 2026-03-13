import { useState } from "react";
import { useCreateUser } from "@workspace/api-client-react";
import PageHeader from "@/components/PageHeader";

const RIGHTS_OPTIONS = [
  { value: "store_manager",    label: "Store Manager" },
  { value: "store_supervisor", label: "Store Supervisor" },
  { value: "administrator",    label: "Administrator" },
] as const;

const BRANCH_OPTIONS = ["501", "511", "502"];

type Rights = "store_manager" | "store_supervisor" | "administrator";

export default function CreateAccount() {
  const [username, setUsername]             = useState("");
  const [forenames, setForenames]           = useState("");
  const [surname, setSurname]               = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [email, setEmail]                   = useState("");
  const [rights, setRights]                 = useState<Rights>("store_manager");
  const [branchCode, setBranchCode]         = useState("501");
  const [isActive, setIsActive]             = useState(true);

  const [savedUserId, setSavedUserId]   = useState<string | null>(null);
  const [setupLink, setSetupLink]       = useState<string | null>(null);
  const [linkCopied, setLinkCopied]     = useState(false);
  const [errorMsg, setErrorMsg]         = useState("");

  const { mutate: createUser, isPending } = useCreateUser({
    mutation: {
      onSuccess: (data: any) => {
        setSavedUserId(data.userId);
        setSetupLink(data.setupLink ?? null);
        setErrorMsg("");
      },
      onError: (err: any) => setErrorMsg(err?.data?.error ?? "Failed to create account"),
    },
  });

  const validate = () => {
    if (!username || !forenames || !surname || !employeeNumber || !email) {
      setErrorMsg("Please fill in all fields, including the staff email address");
      return false;
    }
    return true;
  };

  const reset = () => { setErrorMsg(""); setSavedUserId(null); setSetupLink(null); setLinkCopied(false); };

  const handleActivate = () => {
    if (!validate()) return;
    setIsActive(true);
    createUser({ data: { username, forenames, surname, employeeNumber, email: email || null, rights, storeBranchCode: branchCode, isActive: true } });
  };

  const handleDeactivate = () => {
    if (!validate()) return;
    setIsActive(false);
    createUser({ data: { username, forenames, surname, employeeNumber, email: email || null, rights, storeBranchCode: branchCode, isActive: false } });
  };

  const copyLink = () => {
    if (!setupLink) return;
    navigator.clipboard.writeText(setupLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  };

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: "#1e3f7a" }}>
      <PageHeader
        title={`Account: ${username || "(username)"}`}
        breadcrumb="Home/Create New Account"
      />

      <main className="flex-1 flex flex-col items-start px-8 pt-4 pb-6">
        <div className="w-full max-w-3xl">

          {/* ── Success banner with setup link ── */}
          {savedUserId && (
            <div className="mb-4 rounded-xl overflow-hidden border border-green-400/30">
              <div className="px-5 py-3 bg-green-600/90 text-white text-sm font-semibold flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                </svg>
                Account created! User ID: <strong>{savedUserId}</strong>
              </div>

              {setupLink && (
                <div className="bg-white/95 px-5 py-4">
                  <p className="text-sm text-gray-700 font-medium mb-2">
                    Share this setup link with <strong>{forenames}</strong> so they can set their password:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={setupLink}
                      className="flex-1 text-xs bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-gray-600 font-mono select-all cursor-text"
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      onClick={copyLink}
                      className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition"
                      style={{
                        backgroundColor: linkCopied ? "#16a34a" : "#1e3f7a",
                        color: "white",
                      }}
                    >
                      {linkCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">This link expires in 48 hours.</p>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="mb-3 px-4 py-2 rounded-lg bg-red-600/80 text-white text-sm font-medium">
              {errorMsg}
            </div>
          )}

          <div className="rounded-xl overflow-hidden border border-white/10">
            {/* Header */}
            <div className="grid grid-cols-2" style={{ backgroundColor: "#c8cdd6" }}>
              <div className="px-5 py-3 font-bold text-gray-800 text-sm border-r border-white/30">User ID</div>
              <div className="px-5 py-3 font-bold text-gray-800 text-sm">{savedUserId ?? "Autogenerated"}</div>
            </div>

            <TableRow label="Username">
              <input type="text" value={username} onChange={(e) => { setUsername(e.target.value); reset(); }}
                placeholder="e.g. John_Doe"
                className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-400 text-sm" />
            </TableRow>

            <TableRow label="Fore Name(s)" alt>
              <input type="text" value={forenames} onChange={(e) => { setForenames(e.target.value); reset(); }}
                placeholder="e.g. John"
                className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-400 text-sm" />
            </TableRow>

            <TableRow label="Surname">
              <input type="text" value={surname} onChange={(e) => { setSurname(e.target.value); reset(); }}
                placeholder="e.g. Doe"
                className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-400 text-sm" />
            </TableRow>

            <TableRow label="Employee Number" alt>
              <input type="text" value={employeeNumber} onChange={(e) => { setEmployeeNumber(e.target.value); reset(); }}
                placeholder="e.g. 6987"
                className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-400 text-sm" />
            </TableRow>

            <TableRow label="Staff email address">
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); reset(); }}
                placeholder="e.g. johndoe@company.com"
                className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-400 text-sm" />
            </TableRow>

            {/* Rights */}
            <TableRow label="Rights" alt>
              <div className="flex flex-col gap-1.5">
                {RIGHTS_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="radio" name="rights" value={opt.value}
                      checked={rights === opt.value} onChange={() => setRights(opt.value)}
                      className="accent-blue-700" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </TableRow>

            {/* Store Branch Code */}
            <div
              className="grid grid-cols-2 border-t border-white/10 transition-opacity"
              style={{
                backgroundColor: "#e8eaed",
                opacity: rights === "administrator" ? 0.35 : 1,
              }}
            >
              <div className="px-5 py-3 text-sm text-gray-700 font-medium border-r border-white/30 flex items-start pt-3.5">
                Store Branch Code
              </div>
              <div className="px-5 py-3 flex flex-col gap-1.5">
                {BRANCH_OPTIONS.map((code) => (
                  <label key={code} className={`flex items-center gap-2 text-sm text-gray-700 ${rights === "administrator" ? "cursor-not-allowed" : "cursor-pointer"}`}>
                    <input type="radio" name="branchCode" value={code}
                      checked={branchCode === code}
                      onChange={() => setBranchCode(code)}
                      disabled={rights === "administrator"}
                      className="accent-blue-700" />
                    {code}
                  </label>
                ))}
              </div>
            </div>

            {/* Empty bottom row */}
            <div className="grid grid-cols-2 h-8 border-t border-white/10" style={{ backgroundColor: "#dde0e6" }}>
              <div className="border-r border-white/30" /><div />
            </div>
          </div>

          <div className="flex gap-6 mt-6">
            <button onClick={handleActivate} disabled={isPending}
              className="flex-1 rounded-xl py-3.5 font-semibold text-gray-700 text-base transition hover:brightness-95 active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: "#f0f1f3" }}>
              {isPending && isActive ? "Saving…" : "Active"}
            </button>
            <button onClick={handleDeactivate} disabled={isPending}
              className="flex-1 rounded-xl py-3.5 font-semibold text-gray-500 text-base transition hover:brightness-95 active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: "#b0b5be" }}>
              {isPending && !isActive ? "Saving…" : "Deactivate"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function TableRow({ label, children, alt }: { label: string; children: React.ReactNode; alt?: boolean }) {
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
