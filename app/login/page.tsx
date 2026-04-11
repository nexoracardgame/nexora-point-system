"use client";

import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { useEffect } from "react";
import liff from "@line/liff";

export default function LoginPage() {
  const BG_IMAGE =
    "https://s.imgz.io/2026/04/03/NEXORA496971ca3675ceb2ca.png";

  useEffect(() => {
    async function autoLogin() {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

        if (!liffId) {
          console.error("LIFF ID missing");
         return;
        }

        await liff.init({ liffId });

        // ถ้าเปิดใน LINE app และ login LINE อยู่แล้ว
        if (liff.isInClient()) {
          if (!liff.isLoggedIn()) {
            liff.login();
            return;
          }

          // เข้าเว็บตรงได้เลย
          window.location.href = "/";
        }
      } catch (error) {
        console.error("LIFF auto login failed:", error);
      }
    }

    autoLogin();
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* ===== cinematic zoom background ===== */}
      <motion.div
        initial={{ scale: 1.08 }}
        animate={{ scale: 1 }}
        transition={{ duration: 8, ease: "easeOut" }}
        className="absolute inset-0"
      >
        <img
          src={BG_IMAGE}
          alt="nexora bg"
          className="h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-black" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/40" />
      </motion.div>

      {/* ===== glow ===== */}
      <motion.div
        animate={{
          y: [0, -18, 0],
          opacity: [0.35, 0.65, 0.35],
          scale: [1, 1.06, 1],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute left-1/2 top-[30%] h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl md:h-[420px] md:w-[420px]"
      />

      <motion.div
        animate={{
          y: [0, 18, 0],
          x: [0, 8, 0],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute bottom-[18%] left-[12%] h-[160px] w-[160px] rounded-full bg-orange-500/10 blur-3xl md:h-[280px] md:w-[280px]"
      />

      {/* ===== particles ===== */}
      <div className="pointer-events-none absolute inset-0">
        {[...Array(16)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              opacity: [0, 1, 0],
              y: [0, -160, -240],
              x: [0, i % 2 === 0 ? 16 : -16, 0],
            }}
            transition={{
              duration: 5 + i * 0.4,
              repeat: Infinity,
              delay: i * 0.3,
            }}
            className="absolute h-1 w-1 rounded-full bg-white/60"
            style={{
              left: `${8 + i * 5}%`,
              bottom: "12%",
            }}
          />
        ))}
      </div>

      {/* ===== TOP NAV ===== */}
      <div className="relative z-10 flex items-center justify-between px-4 py-5 md:px-10">
        <div className="text-lg font-black tracking-[0.25em] md:text-2xl">
          NEXORA
        </div>

        <button className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold backdrop-blur-xl">
          SIGN IN
        </button>
      </div>

      {/* ===== CENTER ===== */}
      <div className="relative z-10 flex min-h-[calc(100vh-72px)] flex-col items-center justify-center px-5 text-center md:px-10">
        {/* LOGO */}
        <motion.img
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          src="https://s.imgz.io/2026/04/03/NEXORA--2-copyf365bedcef4c8b64.png"
          alt="NEXORA"
          className="h-auto w-[200px] md:w-[420px] lg:w-[520px]"
        />

        {/* TITLE */}
        <motion.h1
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2 }}
          className="mt-6 text-[32px] font-black leading-[1] md:mt-8 md:text-7xl lg:text-8xl"
        >
          YOUR OWN STORY
          <br />
          IN NEXORA
        </motion.h1>

        {/* SUBTEXT */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 max-w-md text-xs leading-relaxed text-zinc-300 md:mt-5 md:max-w-xl md:text-xl"
        >
          Wallet • Marketplace • Rewards • Competitive Card Ecosystem
        </motion.p>

        {/* LOGIN BUTTON */}
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={() =>
            signIn("line", {
              redirect: true,
              callbackUrl:
                typeof window !== "undefined"
                  ? window.location.origin
                  : "/",
            })
          }
          className="mt-8 w-full max-w-[320px] rounded-[22px] bg-[#06C755] px-6 py-4 text-base font-black text-white shadow-[0_0_40px_rgba(6,199,85,0.45)] md:mt-10 md:max-w-[340px] md:rounded-[24px] md:px-8 md:py-5 md:text-xl"
        >
          LOGIN WITH LINE
        </motion.button>

        {/* FOOTER */}
        <div className="mt-4 text-[10px] text-zinc-400 md:mt-5 md:text-sm">
          Protected by NEXORA Secure Authentication
        </div>

        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-6 text-[10px] text-zinc-400 md:text-sm"
        >
          Scroll to begin ⌄
        </motion.div>
      </div>
    </main>
  );
}