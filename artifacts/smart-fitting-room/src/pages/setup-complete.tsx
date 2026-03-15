import { useLocation } from "wouter";
import { motion } from "framer-motion";

export default function SetupComplete() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden">
      {/* Full-screen background photo */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/success-bg.png)` }}
      />
      {/* Subtle dark overlay to deepen the photo */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Success Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 mx-4"
      >
        <div
          className="rounded-3xl px-16 py-14 flex flex-col items-start cursor-pointer select-none"
          style={{ backgroundColor: "rgba(26, 58, 107, 0.88)" }}
          onClick={() => setLocation("/login")}
        >
          {/* Brand row */}
          <div className="flex items-center gap-3 mb-10">
            {/* Hanger icon */}
            <button
              onClick={(e) => { e.stopPropagation(); setLocation("/user-signin"); }}
              className="hover:opacity-80 transition cursor-pointer"
              title="Go to Home"
              aria-label="Home"
            >
            <svg
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-12 h-12 text-white"
            >
              <path
                d="M32 8C28.686 8 26 10.686 26 14C26 16.761 27.791 19.108 30.286 19.876C30.595 20.37 31.058 20.986 31.6 21.75C26.042 24.011 10 31.2 10 42H54C54 31.2 37.958 24.011 32.4 21.75C32.942 20.986 33.405 20.37 33.714 19.876C36.209 19.108 38 16.761 38 14C38 10.686 35.314 8 32 8Z"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Shirt/garment tag box */}
              <rect x="27" y="14" width="10" height="7" rx="1" fill="white" opacity="0.9" />
              {/* Legs of hanger stand */}
              <line x1="16" y1="42" x2="16" y2="52" stroke="white" strokeWidth="3" strokeLinecap="round" />
              <line x1="48" y1="42" x2="48" y2="52" stroke="white" strokeWidth="3" strokeLinecap="round" />
            </svg>
            </button>
            <span className="text-white text-lg font-medium tracking-wide">
              Smart Fitting Room
            </span>
          </div>

          {/* SUCCESS! */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="text-white font-extrabold tracking-widest uppercase mb-5"
            style={{ fontSize: "clamp(3rem, 8vw, 5.5rem)", letterSpacing: "0.12em" }}
          >
            SUCCESS!
          </motion.h1>

          {/* Proceed link */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-white/90 text-xl font-semibold italic"
          >
            Proceed to Login Page
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
