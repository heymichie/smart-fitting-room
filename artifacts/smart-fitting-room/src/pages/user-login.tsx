import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/[^/]*$/, "") + "/api";

const HangerIcon = () => (
  <svg viewBox="0 0 72 72" fill="none" className="w-14 h-14">
    <path d="M36 9C32.134 9 29 12.134 29 16C29 19.076 30.981 21.685 33.749 22.643C34.065 23.131 34.463 23.683 34.966 24.344C29.244 26.685 9 35.5 9 46H63C63 35.5 42.756 26.685 37.034 24.344C37.537 23.683 37.935 23.131 38.251 22.643C41.019 21.685 43 19.076 43 16C43 12.134 39.866 9 36 9Z" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="30" y="15" width="12" height="8" rx="1.5" fill="white" opacity="0.95"/>
    <line x1="16" y1="46" x2="16" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
    <line x1="56" y1="46" x2="56" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
  </svg>
);

type Stage = "verifying" | "ready" | "invalid" | "success" | "no-token";

export default function UserLogin() {
  const [, setLocation] = useLocation();

  const [stage, setStage]             = useState<Stage>("verifying");
  const [tokenUsername, setTokenUsername] = useState("");
  const [tokenForenames, setTokenForenames] = useState("");
  const [resetToken, setResetToken]   = useState("");

  const [newPassword, setNewPassword]       = useState("");
  const [retypePassword, setRetypePassword] = useState("");
  const [isPending, setIsPending]           = useState(false);
  const [errorMsg, setErrorMsg]             = useState("");
  const [tokenError, setTokenError]         = useState("");

  // On mount — read token from URL and verify it
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStage("no-token");
      return;
    }

    setResetToken(token);

    fetch(`${API_BASE}/user-auth/verify-reset-token?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setTokenUsername(data.username);
          setTokenForenames(data.forenames);
          setStage("ready");
        } else {
          setTokenError(data.error ?? "Invalid or expired link.");
          setStage("invalid");
        }
      })
      .catch(() => {
        setTokenError("Could not reach server. Please try again.");
        setStage("invalid");
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== retypePassword) {
      setErrorMsg("Passwords do not match");
      return;
    }

    setIsPending(true);
    try {
      const res = await fetch(`${API_BASE}/user-auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword, retypePassword }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error ?? "An error occurred"); return; }

      // Auto-login: store the session token returned by reset-password
      if (data.token) {
        localStorage.setItem("sfr_user_token", data.token);
        localStorage.setItem("sfr_user", JSON.stringify({
          userId:     data.userId,
          username:   data.username,
          forenames:  data.forenames,
          surname:    data.surname,
          rights:     data.rights,
          branchCode: data.branchCode,
        }));
        setLocation("/user-dashboard");
        return;
      }

      setStage("success");
    } catch {
      setErrorMsg("Could not reach server. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/success-bg.png)` }}
      />
      <div className="absolute inset-0 bg-black/25" />

      <AnimatePresence mode="wait">

        {/* ── SUCCESS ── */}
        {stage === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="relative z-10 rounded-3xl px-12 py-14 mx-6 w-full max-w-lg flex flex-col items-center text-center"
            style={{ backgroundColor: "rgba(26, 54, 120, 0.93)" }}
          >
            <HangerIcon />
            <span className="text-white/70 text-sm mt-2 mb-8">Smart Fitting Room</span>
            <h1 className="text-white font-black tracking-widest mb-6" style={{ fontSize: "clamp(2.5rem, 8vw, 5rem)" }}>
              SUCCESS!
            </h1>
            <p className="text-white/80 text-sm mb-6">Your password has been set. You can now sign in.</p>
            <button
              onClick={() => setLocation("/user-signin")}
              className="text-white font-bold italic text-sm hover:opacity-75 transition underline underline-offset-4"
            >
              Proceed to Login Page
            </button>
          </motion.div>
        )}

        {/* ── VERIFYING token ── */}
        {stage === "verifying" && (
          <motion.div
            key="verifying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex items-center gap-3 text-white text-lg font-medium"
          >
            <svg className="animate-spin w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Verifying your link…
          </motion.div>
        )}

        {/* ── INVALID / EXPIRED token ── */}
        {stage === "invalid" && (
          <motion.div
            key="invalid"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 rounded-3xl px-10 py-12 mx-6 max-w-md text-center flex flex-col items-center gap-4"
            style={{ backgroundColor: "rgba(255,255,255,0.92)" }}
          >
            <svg className="w-14 h-14 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
            </svg>
            <h2 className="text-xl font-bold" style={{ color: "#1e3a6e" }}>Link Invalid or Expired</h2>
            <p className="text-gray-600 text-sm">{tokenError}</p>
            <Link href="/user-signin" className="text-sm font-semibold hover:underline" style={{ color: "#1e3a6e" }}>
              Go to Sign In
            </Link>
          </motion.div>
        )}

        {/* ── NO TOKEN (direct access without a link) ── */}
        {stage === "no-token" && (
          <motion.div
            key="no-token"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 rounded-3xl px-10 py-12 mx-6 max-w-md text-center flex flex-col items-center gap-4"
            style={{ backgroundColor: "rgba(255,255,255,0.92)" }}
          >
            <HangerIcon />
            <h2 className="text-xl font-bold mt-2" style={{ color: "#1e3a6e" }}>Account Setup</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              To set up your account, please use the link sent to your email address when your account was created.
            </p>
            <Link href="/user-signin" className="text-sm font-semibold hover:underline" style={{ color: "#1e3a6e" }}>
              Already have a password? Sign In
            </Link>
          </motion.div>
        )}

        {/* ── READY — password setup form ── */}
        {stage === "ready" && (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative z-10 flex items-stretch mx-4"
          >
            {/* Left — blue branding card */}
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="flex flex-col justify-between rounded-3xl p-8 w-64 md:w-72 shrink-0"
              style={{ backgroundColor: "rgba(30, 67, 140, 0.92)" }}
            >
              <div className="flex flex-col items-start gap-3">
                <button
                  onClick={() => setLocation("/user-signin")}
                  className="hover:opacity-80 transition cursor-pointer"
                  title="Go to Home"
                  aria-label="Home"
                >
                  <HangerIcon />
                </button>
                <span className="text-white/80 text-sm font-medium tracking-wide">Smart Fitting Room</span>
              </div>
              <div>
                <h1 className="text-white text-3xl md:text-4xl font-bold leading-tight">
                  Hello, Welcome,<br />please log in
                </h1>
              </div>
            </motion.div>

            {/* Right — form panel */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
              className="flex flex-col justify-center rounded-3xl px-8 py-10 w-72 md:w-80"
              style={{ backgroundColor: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)" }}
            >
              <h2 className="font-bold mb-1 leading-tight" style={{ color: "#1e3a6e", fontSize: "clamp(1.6rem, 3.5vw, 2.2rem)" }}>
                New Sign in
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Hi <span className="font-semibold">{tokenForenames}</span>, please create your password.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                {/* Read-only username */}
                <input
                  type="text"
                  value={tokenUsername}
                  readOnly
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-gray-500 text-sm cursor-default select-none"
                />

                <input
                  type="password"
                  placeholder="Type New Password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setErrorMsg(""); }}
                  className="w-full rounded-xl border border-gray-300 bg-white/80 px-4 py-3 text-center text-gray-600 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition"
                  autoComplete="new-password"
                  required
                />
                <input
                  type="password"
                  placeholder="Retype Password"
                  value={retypePassword}
                  onChange={(e) => { setRetypePassword(e.target.value); setErrorMsg(""); }}
                  className="w-full rounded-xl border border-gray-300 bg-white/80 px-4 py-3 text-center text-gray-600 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition"
                  autoComplete="new-password"
                  required
                />

                <AnimatePresence>
                  {errorMsg && (
                    <motion.p
                      key="err"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-red-600 text-xs text-center bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                    >
                      {errorMsg}
                    </motion.p>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full rounded-xl py-3 text-white font-semibold text-sm tracking-wide transition hover:opacity-90 active:scale-[0.98] mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#1e3a6e" }}
                >
                  {isPending ? "Setting up…" : "Login"}
                </button>

                <div className="text-center mt-1">
                  <Link href="/login" className="text-xs font-bold hover:underline transition" style={{ color: "#1e3a6e" }}>
                    Administrator Login
                  </Link>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
