"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const DEFAULT_CALLBACK_PATH = "/";

function isUnsafeCallbackPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/api/auth");
}

function resolveCallbackPath(rawCallbackUrl?: string | null, depth = 0): string {
  if (typeof window === "undefined") {
    return DEFAULT_CALLBACK_PATH;
  }

  if (depth > 2) {
    return DEFAULT_CALLBACK_PATH;
  }

  const raw = String(rawCallbackUrl || "").trim();

  if (!raw) {
    return DEFAULT_CALLBACK_PATH;
  }

  try {
    const parsed = new URL(raw, window.location.origin);

    if (parsed.origin !== window.location.origin) {
      return DEFAULT_CALLBACK_PATH;
    }

    if (isUnsafeCallbackPath(parsed.pathname)) {
      const nestedCallback = parsed.searchParams.get("callbackUrl");
      return nestedCallback
        ? resolveCallbackPath(nestedCallback, depth + 1)
        : DEFAULT_CALLBACK_PATH;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_CALLBACK_PATH;
  }
}

function resolveCallbackUrl(rawCallbackUrl?: string | null) {
  if (typeof window === "undefined") {
    return DEFAULT_CALLBACK_PATH;
  }

  return new URL(resolveCallbackPath(rawCallbackUrl), window.location.origin).toString();
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
  const router = useRouter();
  const { status } = useSession();
  const [pendingProvider, setPendingProvider] = useState<
    "line" | "google" | "session" | null
  >(null);
  const BG_IMAGE =
    "https://s.imgz.io/2026/04/03/NEXORA496971ca3675ceb2ca.png";
  const callbackPath = useMemo(
    () => resolveCallbackPath(rawCallbackUrl),
    [rawCallbackUrl]
  );
  const callbackUrl = useMemo(
    () => resolveCallbackUrl(rawCallbackUrl),
    [rawCallbackUrl]
  );
  const authErrorMessage = getAuthErrorMessage(authError);
  const isRedirecting =
    pendingProvider !== null || status === "authenticated";
  const pendingLabel =
    pendingProvider === "google"
      ? "กำลังเชื่อมต่อบัญชี Google..."
      : pendingProvider === "line"
        ? "กำลังเชื่อมต่อบัญชี LINE..."
        : "กำลังพาเข้าแอพ...";

  const startLogin = useCallback(
    async (provider: "line" | "google") => {
      if (pendingProvider || status === "authenticated") {
        return;
      }

      setPendingProvider(provider);

      try {
        await signIn(provider, {
          redirect: true,
          callbackUrl,
        });
      } catch (error) {
        console.error("AUTH SIGN IN ERROR:", error);
        setPendingProvider(null);
      }
    },
    [callbackUrl, pendingProvider, status]
  );

  const handleLineLogin = () => startLogin("line");

  const handleGoogleLogin = () => startLogin("google");

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    setPendingProvider("session");
    router.replace(callbackPath);
    router.refresh();
  }, [callbackPath, router, status]);

  useEffect(() => {
    async function warmLineClient() {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

        if (!liffId) {
          return;
        }

        const userAgent = window.navigator.userAgent.toLowerCase();
        if (!userAgent.includes("line")) {
          return;
        }

        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
      } catch (error) {
        console.error("LIFF warmup failed:", error);
      }
    }

    void warmLineClient();
  }, []);

  return (
    <main
      aria-busy={isRedirecting}
      className="relative min-h-[var(--app-shell-height)] overflow-hidden bg-black text-white"
    >
      {isRedirecting ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/78 px-5 text-center backdrop-blur-xl">
          <div className="w-full max-w-sm rounded-[28px] border border-white/14 bg-[radial-gradient(circle_at_top,#171717,#050505_72%)] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/18 border-t-[#06C755]" />
            <div className="mt-5 text-xl font-black">กำลังเข้าสู่ NEX POINT</div>
            <p className="mt-2 text-sm font-semibold leading-6 text-white/62">
              {pendingLabel} กรุณารอสักครู่ ไม่ต้องกดซ้ำ
            </p>
          </div>
        </div>
      ) : null}
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
          disabled={isRedirecting}
          className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold backdrop-blur-xl transition disabled:cursor-wait disabled:opacity-60"
        >
          {isRedirecting ? "SIGNING IN..." : "SIGN IN"}
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
            disabled={isRedirecting}
            className="min-h-[58px] rounded-[22px] bg-[#06C755] px-6 py-4 text-base font-black text-white shadow-[0_0_40px_rgba(6,199,85,0.45)] transition disabled:cursor-wait disabled:opacity-70 md:min-h-[68px] md:rounded-[24px] md:px-8 md:py-5 md:text-xl"
          >
            {pendingProvider === "line" ? "CONNECTING LINE..." : "LOGIN WITH LINE"}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.035 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => void handleGoogleLogin()}
            disabled={isRedirecting}
            className="flex min-h-[58px] items-center justify-center gap-3 rounded-[22px] bg-white px-6 py-4 text-base font-black text-black shadow-[0_0_40px_rgba(255,255,255,0.16)] ring-1 ring-white/15 transition disabled:cursor-wait disabled:opacity-70 md:min-h-[68px] md:rounded-[24px] md:px-8 md:py-5 md:text-xl"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full border border-black/10 bg-white text-lg font-black text-[#4285F4]">
              G
            </span>
            {pendingProvider === "google"
              ? "CONNECTING GOOGLE..."
              : "LOGIN WITH GOOGLE"}
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
