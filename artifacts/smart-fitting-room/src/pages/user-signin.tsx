import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/[^/]*$/, "") + "/api";

const HangerIcon = () => (
  <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14">
    <path d="M36 9C32.134 9 29 12.134 29 16C29 19.076 30.981 21.685 33.749 22.643C34.065 23.131 34.463 23.683 34.966 24.344C29.244 26.685 9 35.5 9 46H63C63 35.5 42.756 26.685 37.034 24.344C37.537 23.683 37.935 23.131 38.251 22.643C41.019 21.685 43 19.076 43 16C43 12.134 39.866 9 36 9Z"
      stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="30" y="15" width="12" height="8" rx="1.5" fill="white" opacity="0.95"/>
    <line x1="16" y1="46" x2="16" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
    <line x1="56" y1="46" x2="56" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
  </svg>
);

export default function UserSignIn() {
  const [, setLocation] = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [branchCode, setBranchCode] = useState("501");
  const [isPending, setIsPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const BRANCH_OPTIONS = ["501", "511", "502"];

  // Forgot-password modal state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotPending, setForgotPending] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsPending(true);
    try {
      const res = await fetch(`${API_BASE}/user-auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Invalid username or password");
        return;
      }

      // First-time login with default password — redirect to password setup
      if (data.mustChangePassword && data.resetToken) {
        setLocation(`/user-login?token=${data.resetToken}`);
        return;
      }

      localStorage.setItem("sfr_user_token", data.token);
      localStorage.setItem("sfr_user", JSON.stringify({
        userId:    data.userId,
        username:  data.username,
        forenames: data.forenames,
        surname:   data.surname,
        rights:    data.rights,
        branchCode: branchCode || data.branchCode,
      }));
      setLocation("/user-dashboard");
    } catch {
      setErrorMsg("Could not reach server. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg("");
    setForgotPending(true);
    try {
      const res = await fetch(`${API_BASE}/user-auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUsername.trim() }),
      });
      const data = await res.json();
      setForgotMsg(data.message ?? "Reset link sent.");
    } catch {
      setForgotMsg("Could not reach server. Please try again.");
    } finally {
      setForgotPending(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/success-bg.png)` }}
      />
      <div className="absolute inset-0 bg-black/25" />

      {/* Forgot Password modal */}
      <AnimatePresence>
        {showForgot && (
          <motion.div
            key="forgot-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 px-4"
            onClick={() => { setShowForgot(false); setForgotMsg(""); setForgotUsername(""); }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="rounded-3xl px-8 py-10 w-full max-w-sm flex flex-col gap-4"
              style={{ backgroundColor: "rgba(255,255,255,0.95)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold" style={{ color: "#1e3a6e" }}>Forgot Password</h2>
              <p className="text-sm text-gray-500">Enter your username and we'll send a reset link to your registered email.</p>

              {forgotMsg ? (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-center">
                  {forgotMsg}
                </p>
              ) : (
                <form onSubmit={handleForgot} className="flex flex-col gap-3">
                  <input
                    type="text"
                    placeholder="Username"
                    value={forgotUsername}
                    onChange={(e) => setForgotUsername(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-center text-gray-600 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition"
                    required
                  />
                  <button
                    type="submit"
                    disabled={forgotPending}
                    className="w-full rounded-xl py-3 text-white font-semibold text-sm transition hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: "#1e3a6e" }}
                  >
                    {forgotPending ? "Sending…" : "Send Reset Link"}
                  </button>
                </form>
              )}

              <button
                onClick={() => { setShowForgot(false); setForgotMsg(""); setForgotUsername(""); }}
                className="text-xs text-gray-400 hover:text-gray-600 text-center transition"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex items-stretch mx-4">

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

        {/* Right — sign-in panel */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="flex flex-col justify-center rounded-3xl px-8 py-10 w-72 md:w-80"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.88)", backdropFilter: "blur(8px)" }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setErrorMsg(""); }}
              className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-center text-gray-700 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition"
              autoComplete="username"
              required
            />

            <div className="flex flex-col gap-1">
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
                  onClick={() => { setShowForgot(true); setForgotUsername(username); }}
                  className="text-xs text-gray-500 hover:text-blue-700 transition"
                >
                  Forgot Password
                </button>
              </div>
            </div>

            {/* Store Branch Code */}
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <div className="grid grid-cols-2" style={{ backgroundColor: "#e8eaed" }}>
                <div className="px-4 py-3 text-sm text-gray-700 font-medium border-r border-gray-200 flex items-center">
                  Store Branch Code
                </div>
                <div className="px-4 py-2 flex flex-col gap-1">
                  {BRANCH_OPTIONS.map((code) => (
                    <label key={code} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name="branchCode"
                        value={code}
                        checked={branchCode === code}
                        onChange={() => setBranchCode(code)}
                        className="accent-blue-700"
                      />
                      {code}
                    </label>
                  ))}
                </div>
              </div>
            </div>

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
              disabled={isPending}
              className="w-full rounded-xl py-3 text-white font-semibold text-sm tracking-wide transition hover:opacity-90 active:scale-[0.98] mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: "rgba(26, 58, 107, 0.95)" }}
            >
              {isPending ? "Signing in…" : "Login"}
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

      </div>
    </div>
  );
}
