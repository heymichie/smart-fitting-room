import { useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/[^/]*$/, "") + "/api";

type Mode = "new" | "returning" | "idle";

const HangerIcon = () => (
  <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14">
    <path
      d="M36 9C32.134 9 29 12.134 29 16C29 19.076 30.981 21.685 33.749 22.643C34.065 23.131 34.463 23.683 34.966 24.344C29.244 26.685 9 35.5 9 46H63C63 35.5 42.756 26.685 37.034 24.344C37.537 23.683 37.935 23.131 38.251 22.643C41.019 21.685 43 19.076 43 16C43 12.134 39.866 9 36 9Z"
      stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
    />
    <rect x="30" y="15" width="12" height="8" rx="1.5" fill="white" opacity="0.95" />
    <line x1="16" y1="46" x2="16" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="56" y1="46" x2="56" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

export default function UserLogin() {
  const [, setLocation] = useLocation();

  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [retypePassword, setRetypePassword] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [checking, setChecking] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const usernameChecked = useRef<string>("");

  const checkUsername = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === usernameChecked.current) return;
    usernameChecked.current = trimmed;
    setChecking(true);
    setErrorMsg("");
    setMode("idle");
    try {
      const res = await fetch(`${API_BASE}/user-auth/check?username=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "User not found");
        return;
      }
      setMode(data.passwordSet ? "returning" : "new");
    } catch {
      setErrorMsg("Could not reach server. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (mode === "idle") {
      await checkUsername(username);
      return;
    }

    if (mode === "new") {
      if (newPassword !== retypePassword) {
        setErrorMsg("Passwords do not match");
        return;
      }
      if (newPassword.length < 6) {
        setErrorMsg("Password must be at least 6 characters");
        return;
      }
    }

    setIsPending(true);
    try {
      const endpoint = mode === "new" ? "/user-auth/set-password" : "/user-auth/login";
      const body = mode === "new"
        ? { username: username.trim(), newPassword, retypePassword }
        : { username: username.trim(), password };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "An error occurred");
        return;
      }

      if (mode === "new") {
        // First-time setup complete — show success screen
        setShowSuccess(true);
      } else {
        // Returning login — store session and go to dashboard
        localStorage.setItem("sfr_user_token", data.token);
        localStorage.setItem("sfr_user", JSON.stringify({
          userId:    data.userId,
          username:  data.username,
          forenames: data.forenames,
          surname:   data.surname,
          rights:    data.rights,
          branchCode: data.branchCode,
        }));
        setLocation("/user-dashboard");
      }
    } catch {
      setErrorMsg("Could not reach server. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  const handleUsernameBlur = () => {
    if (username.trim()) checkUsername(username);
  };

  const handleUsernameChange = (v: string) => {
    setUsername(v);
    if (usernameChecked.current && v.trim() !== usernameChecked.current) {
      usernameChecked.current = "";
      setMode("idle");
      setErrorMsg("");
    }
  };

  const handleProceedToLogin = () => {
    // Reset form to clean returning-user state
    setShowSuccess(false);
    setNewPassword("");
    setRetypePassword("");
    setPassword("");
    setErrorMsg("");
    usernameChecked.current = "";
    setMode("idle");
    // Re-check so it immediately shows the returning form
    checkUsername(username);
  };

  const title = mode === "new" ? "New Sign in" : "Sign in";

  const bgStyle = {
    backgroundImage: `url(${import.meta.env.BASE_URL}images/success-bg.png)`,
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-cover bg-center" style={bgStyle} />
      <div className="absolute inset-0 bg-black/25" />

      <AnimatePresence mode="wait">

        {/* ── SUCCESS CARD ─────────────────────────────────────────── */}
        {showSuccess && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="relative z-10 rounded-3xl px-12 py-12 mx-6 w-full max-w-2xl flex flex-col"
            style={{ backgroundColor: "rgba(26, 54, 120, 0.93)" }}
          >
            {/* Brand top-left */}
            <div className="flex items-center gap-2 mb-10">
              <HangerIcon />
              <span className="text-white/80 text-sm font-medium tracking-wide ml-1">Smart Fitting Room</span>
            </div>

            {/* SUCCESS text */}
            <div className="flex flex-col items-center justify-center flex-1 text-center gap-5">
              <h1 className="text-white font-black tracking-widest" style={{ fontSize: "clamp(2.8rem, 8vw, 5rem)", letterSpacing: "0.08em" }}>
                SUCCESS!
              </h1>

              <button
                onClick={handleProceedToLogin}
                className="text-white font-bold italic text-base hover:opacity-75 transition underline underline-offset-4"
              >
                Proceed to Login Page
              </button>
            </div>
          </motion.div>
        )}

        {/* ── SIGN-IN CARD PAIR ─────────────────────────────────────── */}
        {!showSuccess && (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative z-10 flex items-stretch mx-4"
          >
            {/* Left — branding card */}
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="flex flex-col justify-between rounded-3xl p-8 w-64 md:w-72 shrink-0"
              style={{ backgroundColor: "rgba(30, 67, 140, 0.92)" }}
            >
              <div className="flex flex-col items-start gap-3">
                <HangerIcon />
                <span className="text-white/80 text-sm font-medium tracking-wide">Smart Fitting Room</span>
              </div>
              <div className="mt-10">
                <h1 className="text-white text-3xl md:text-4xl font-bold leading-tight">
                  Hello,<br />Welcome!
                </h1>
              </div>
            </motion.div>

            {/* Right — form panel */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
              className="flex flex-col justify-center rounded-3xl px-8 py-10 w-72 md:w-80"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.82)", backdropFilter: "blur(12px)" }}
            >
              {/* Title — only shown for new-user setup */}
              {mode === "new" && (
                <h2 className="text-2xl md:text-3xl font-bold mb-6" style={{ color: "#1e3f7a" }}>
                  New Sign in
                </h2>
              )}

              <form onSubmit={handleSubmit} className={`flex flex-col gap-3 ${mode !== "new" ? "mt-2" : ""}`}>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  onBlur={handleUsernameBlur}
                  className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-center text-gray-700 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition"
                  autoComplete="username"
                  required
                />

                {checking && (
                  <p className="text-xs text-center text-blue-600 animate-pulse">Checking account…</p>
                )}

                {/* New-user fields */}
                <AnimatePresence>
                  {mode === "new" && (
                    <motion.div
                      key="new-fields"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex flex-col gap-3 overflow-hidden"
                    >
                      <input
                        type="password"
                        placeholder="Type New Password"
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setErrorMsg(""); }}
                        className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-center text-gray-700 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition"
                        autoComplete="new-password"
                        required
                      />
                      <input
                        type="password"
                        placeholder="Retype Password"
                        value={retypePassword}
                        onChange={(e) => { setRetypePassword(e.target.value); setErrorMsg(""); }}
                        className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-center text-gray-700 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition"
                        autoComplete="new-password"
                        required
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Returning-user password + Forgot Password */}
                <AnimatePresence>
                  {mode === "returning" && (
                    <motion.div
                      key="returning-field"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex flex-col gap-1 overflow-hidden"
                    >
                      <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setErrorMsg(""); }}
                        className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-center text-gray-700 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition"
                        autoComplete="current-password"
                        required
                      />
                      <div className="flex justify-end pr-1">
                        <button
                          type="button"
                          className="text-xs text-gray-500 hover:text-blue-700 transition"
                        >
                          Forgot Password
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error */}
                <AnimatePresence>
                  {errorMsg && (
                    <motion.p
                      key="error"
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
                  disabled={isPending || checking}
                  className="w-full rounded-xl py-3 text-white font-semibold text-sm tracking-wide transition hover:opacity-90 active:scale-[0.98] mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "rgba(26, 58, 107, 0.95)" }}
                >
                  {isPending ? (mode === "new" ? "Setting up…" : "Signing in…") : "Login"}
                </button>

                <div className="text-center mt-1">
                  <Link
                    href="/login"
                    className="text-xs font-semibold hover:underline transition"
                    style={{ color: "#1e3f7a" }}
                  >
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
