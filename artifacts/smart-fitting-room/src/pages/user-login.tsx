import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/[^/]*$/, "") + "/api";

export default function UserLogin() {
  const [, setLocation] = useLocation();

  const [username, setUsername]             = useState("");
  const [newPassword, setNewPassword]       = useState("");
  const [retypePassword, setRetypePassword] = useState("");
  const [isPending, setIsPending]           = useState(false);
  const [errorMsg, setErrorMsg]             = useState("");
  const [showSuccess, setShowSuccess]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (newPassword !== retypePassword) {
      setErrorMsg("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters");
      return;
    }

    setIsPending(true);
    try {
      const res = await fetch(`${API_BASE}/user-auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), newPassword, retypePassword }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error ?? "An error occurred"); return; }
      setShowSuccess(true);
    } catch {
      setErrorMsg("Could not reach server. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/success-bg.png)` }}
      />
      <div className="absolute inset-0 bg-black/25" />

      <AnimatePresence mode="wait">

        {/* ── SUCCESS screen ── */}
        {showSuccess && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="relative z-10 rounded-3xl px-12 py-14 mx-6 w-full max-w-2xl flex flex-col"
            style={{ backgroundColor: "rgba(26, 54, 120, 0.93)" }}
          >
            {/* Brand */}
            <div className="flex items-center gap-3 mb-10">
              <svg viewBox="0 0 72 72" fill="none" className="w-12 h-12">
                <path d="M36 9C32.134 9 29 12.134 29 16C29 19.076 30.981 21.685 33.749 22.643C34.065 23.131 34.463 23.683 34.966 24.344C29.244 26.685 9 35.5 9 46H63C63 35.5 42.756 26.685 37.034 24.344C37.537 23.683 37.935 23.131 38.251 22.643C41.019 21.685 43 19.076 43 16C43 12.134 39.866 9 36 9Z" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="30" y="15" width="12" height="8" rx="1.5" fill="white" opacity="0.95"/>
                <line x1="16" y1="46" x2="16" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
                <line x1="56" y1="46" x2="56" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
              </svg>
              <span className="text-white/80 text-sm font-medium">Smart Fitting Room</span>
            </div>
            <div className="flex flex-col items-center text-center gap-6 py-4">
              <h1 className="text-white font-black tracking-widest" style={{ fontSize: "clamp(3rem, 9vw, 5.5rem)" }}>
                SUCCESS!
              </h1>
              <button
                onClick={() => setLocation("/user-signin")}
                className="text-white font-bold italic text-base hover:opacity-75 transition underline underline-offset-4"
              >
                Proceed to Login Page
              </button>
            </div>
          </motion.div>
        )}

        {/* ── NEW SIGN IN form ── */}
        {!showSuccess && (
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
              {/* Brand */}
              <div className="flex flex-col items-start gap-3">
                <svg viewBox="0 0 72 72" fill="none" className="w-14 h-14">
                  <path d="M36 9C32.134 9 29 12.134 29 16C29 19.076 30.981 21.685 33.749 22.643C34.065 23.131 34.463 23.683 34.966 24.344C29.244 26.685 9 35.5 9 46H63C63 35.5 42.756 26.685 37.034 24.344C37.537 23.683 37.935 23.131 38.251 22.643C41.019 21.685 43 19.076 43 16C43 12.134 39.866 9 36 9Z" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="30" y="15" width="12" height="8" rx="1.5" fill="white" opacity="0.95"/>
                  <line x1="16" y1="46" x2="16" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
                  <line x1="56" y1="46" x2="56" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
                </svg>
                <span className="text-white/80 text-sm font-medium tracking-wide">Smart Fitting Room</span>
              </div>

              {/* Welcome */}
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
              {/* Title */}
              <h2
                className="font-bold mb-5 leading-tight"
                style={{ color: "#1e3a6e", fontSize: "clamp(1.6rem, 3.5vw, 2.2rem)" }}
              >
                New Sign in
              </h2>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setErrorMsg(""); }}
                  className="w-full rounded-xl border border-gray-300 bg-white/80 px-4 py-3 text-center text-gray-600 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition"
                  autoComplete="username"
                  required
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
                  <Link
                    href="/login"
                    className="text-xs font-bold hover:underline transition"
                    style={{ color: "#1e3a6e" }}
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
