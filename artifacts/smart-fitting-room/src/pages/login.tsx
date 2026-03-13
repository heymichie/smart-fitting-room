import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAdminLogin } from "@workspace/api-client-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const { mutate: login, isPending } = useAdminLogin({
    mutation: {
      onSuccess: (data) => {
        localStorage.setItem("sfr_admin_token", data.token);
        localStorage.setItem("sfr_admin_user", JSON.stringify({
          username: data.username,
          organisationTradingName: data.organisationTradingName,
          administratorForenames: data.administratorForenames,
          surname: data.surname,
          designation: data.designation,
        }));
        setLocation("/dashboard");
      },
      onError: (error: any) => {
        setErrorMsg(error?.data?.error ?? "Invalid username or password");
      },
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    login({ data: { username, password } });
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden">
      {/* Full-screen background photo */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/success-bg.png)` }}
      />
      {/* Subtle dark overlay */}
      <div className="absolute inset-0 bg-black/25" />

      {/* Card pair */}
      <div className="relative z-10 flex items-stretch mx-4">

        {/* Left — Blue branding card */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col justify-between rounded-3xl p-8 w-64 md:w-72 shrink-0"
          style={{ backgroundColor: "rgba(30, 67, 140, 0.92)" }}
        >
          {/* Brand */}
          <div className="flex flex-col items-start gap-3">
            <div className="relative">
              <svg
                viewBox="0 0 72 72"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-14 h-14 text-white"
              >
                <path
                  d="M36 9C32.134 9 29 12.134 29 16C29 19.076 30.981 21.685 33.749 22.643C34.065 23.131 34.463 23.683 34.966 24.344C29.244 26.685 9 35.5 9 46H63C63 35.5 42.756 26.685 37.034 24.344C37.537 23.683 37.935 23.131 38.251 22.643C41.019 21.685 43 19.076 43 16C43 12.134 39.866 9 36 9Z"
                  stroke="white"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <rect x="30" y="15" width="12" height="8" rx="1.5" fill="white" opacity="0.95" />
                <line x1="16" y1="46" x2="16" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
                <line x1="56" y1="46" x2="56" y2="58" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-white/80 text-sm font-medium tracking-wide">Smart Fitting Room</span>
          </div>

          {/* Welcome text */}
          <div className="mt-10">
            <h1 className="text-white text-3xl md:text-4xl font-bold leading-tight">
              Hello,<br />please log in
            </h1>
          </div>
        </motion.div>

        {/* Right — Login form panel */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="flex flex-col justify-center rounded-3xl px-8 py-10 w-72 md:w-80"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.82)", backdropFilter: "blur(12px)" }}
        >
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {/* Username */}
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setErrorMsg(""); }}
              className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-center text-gray-700 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition"
              autoComplete="username"
              required
            />

            {/* Password */}
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
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-blue-700 transition pr-1"
                >
                  Forgot Password
                </button>
              </div>
            </div>

            {/* Error message */}
            {errorMsg && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-600 text-xs text-center bg-red-50 border border-red-200 rounded-lg px-3 py-2"
              >
                {errorMsg}
              </motion.p>
            )}

            {/* Login button */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-xl py-3 text-white font-semibold text-sm tracking-wide transition hover:opacity-90 active:scale-[0.98] mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: "rgba(26, 58, 107, 0.95)" }}
            >
              {isPending ? "Logging in…" : "Login"}
            </button>

            <div className="text-center mt-1">
              <a
                href="/user-signin"
                className="text-xs font-bold hover:underline transition"
                style={{ color: "#1e3f7a" }}
              >
                Staff Login
              </a>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
