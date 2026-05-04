"use client";

import { useEffect } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { motion } from "framer-motion";
import liff from "@line/liff";

function resolveCallbackUrl(rawCallbackUrl?: string | null) {
  if (typeof window === "undefined") {
    return "/";
  }

  const fallback = window.location.origin;
  const raw = String(rawCallbackUrl || "").trim();

  if (!raw) {
    return fallback;
  }

  try {
    if (raw.startsWith("/")) {
      return new URL(raw, window.location.origin).toString();
    }

    const parsed = new URL(raw);

    if (parsed.origin === window.location.origin) {
      return parsed.toString();
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function getAuthErrorMessage(error?: string | null) {
  if (!error) {
    return "";
  }

  if (error === "OAuthAccountNotLinked") {
    return "บัญชีนี้เคยล็อกอินด้วยวิธีอื่นไว้แล้ว กรุณาใช้วิธีเดิมก่อน";
  }

  if (error === "AccessDenied") {
    return "ระบบยังไม่อนุญาตให้เข้าสู่ระบบด้วยบัญชีนี้";
  }

  return "ล็อกอินไม่สำเร็จ กรุณาลองอีกครั้ง";
}

export default function LoginClient({
  rawCallbackUrl,
  authError,
}: {
  rawCallbackUrl?: string | null;
  authError?: string | null;
}) {
  const BG_IMAGE =
    "https://s.imgz.io/2026/04/03/NEXORA496971ca3675ceb2ca.png";
  const callbackUrl = resolveCallbackUrl(rawCallbackUrl);
  const authErrorMessage = getAuthErrorMessage(authError);

  const handleLineLogin = () =>
    signIn("line", {
      redirect: true,
      callbackUrl,
    });

  const handleGoogleLogin = () =>
    signIn("google", {
      redirect: true,
      callbackUrl,
    });

  useEffect(() => {
    async function autoLogin() {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

        if (!liffId) {
          console.error("LIFF ID missing");
          return;
        }

        await liff.init({ liffId });

        if (liff.isInClient()) {
          if (!liff.isLoggedIn()) {
            liff.login({ redirectUri: callbackUrl });
            return;
          }

          window.location.href = callbackUrl;
        }
      } catch (error) {
        console.error("LIFF auto login failed:", error);
      }
    }

    void autoLogin();
  }, [callbackUrl]);

  return (
    <main className="relative min-h-[var(--app-shell-height)] overflow-hidden bg-black text-white">
      <motion.div
        initial={{ scale: 1.08 }}
        animate={{ scale: 1 }}
        transition={{ duration: 8, ease: "easeOut" }}
        className="absolute inset-0"
      >
        <Image
          src={BG_IMAGE}
          alt="nexora bg"
          fill
          sizes="100vw"
          className="h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-black" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/40" />
      </motion.div>

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

      <div className="relative z-10 flex items-center justify-between px-4 py-5 md:px-10">
        <div className="text-lg font-black tracking-[0.25em] md:text-2xl">
          NEXORA
        </div>

        <button
          onClick={() => void handleLineLogin()}
          className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold backdrop-blur-xl"
        >
          SIGN IN
        </button>
      </div>

      <div className="relative z-10 flex min-h-[calc(var(--app-shell-height)-72px)] flex-col items-center justify-center px-5 text-center md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="relative h-[72px] w-[200px] md:h-[150px] md:w-[420px] lg:h-[186px] lg:w-[520px]"
        >
          <Image
            src="https://s.imgz.io/2026/04/03/NEXORA--2-copyf365bedcef4c8b64.png"
            alt="NEXORA"
            fill
            sizes="(max-width: 768px) 200px, (max-width: 1200px) 420px, 520px"
            className="object-contain"
          />
        </motion.div>

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

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 max-w-md text-xs leading-relaxed text-zinc-300 md:mt-5 md:max-w-xl md:text-xl"
        >
          Wallet • Marketplace • Rewards • Competitive Card Ecosystem
        </motion.p>

        <div className="mt-8 grid w-full max-w-[680px] gap-3 sm:grid-cols-2 md:mt-10">
          <motion.button
            whileHover={{ scale: 1.035 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => void handleLineLogin()}
            className="min-h-[58px] rounded-[22px] bg-[#06C755] px-6 py-4 text-base font-black text-white shadow-[0_0_40px_rgba(6,199,85,0.45)] md:min-h-[68px] md:rounded-[24px] md:px-8 md:py-5 md:text-xl"
          >
            LOGIN WITH LINE
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.035 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => void handleGoogleLogin()}
            className="flex min-h-[58px] items-center justify-center gap-3 rounded-[22px] bg-white px-6 py-4 text-base font-black text-black shadow-[0_0_40px_rgba(255,255,255,0.16)] ring-1 ring-white/15 md:min-h-[68px] md:rounded-[24px] md:px-8 md:py-5 md:text-xl"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full border border-black/10 bg-white text-lg font-black text-[#4285F4]">
              G
            </span>
            LOGIN WITH GOOGLE
          </motion.button>
        </div>

        {authErrorMessage ? (
          <div className="mt-4 rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm font-bold text-red-100 shadow-[0_18px_38px_rgba(220,38,38,0.16)] backdrop-blur-xl">
            {authErrorMessage}
          </div>
        ) : null}

        <div className="mt-4 text-[10px] text-zinc-400 md:mt-5 md:text-sm">
          Protected by NEXORA Secure Authentication
        </div>

        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-6 text-[10px] text-zinc-400 md:text-sm"
        >
          Scroll to begin
        </motion.div>
      </div>
    </main>
  );
}
