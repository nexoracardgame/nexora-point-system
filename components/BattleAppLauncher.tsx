"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  Maximize2,
  MonitorSmartphone,
  Plus,
  Share,
  Smartphone,
  Swords,
  X,
} from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

type InstallState = "loading" | "ready" | "ios" | "fallback" | "installed";

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (
    orientation:
      | "any"
      | "natural"
      | "landscape"
      | "portrait"
      | "portrait-primary"
      | "portrait-secondary"
      | "landscape-primary"
      | "landscape-secondary"
  ) => Promise<void>;
};

function isIosDevice() {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isTouchMac =
    window.navigator.platform === "MacIntel" &&
    window.navigator.maxTouchPoints > 1;

  return /iphone|ipad|ipod/.test(userAgent) || isTouchMac;
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  const iosNavigator = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    iosNavigator.standalone === true
  );
}

async function requestGameViewport() {
  if (typeof window === "undefined") return;

  try {
    const orientation = window.screen.orientation as ScreenOrientationWithLock;
    await orientation.lock?.("landscape");
  } catch {
    // Browsers can reject orientation lock unless the app is installed or fullscreen.
  }

  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.({
        navigationUI: "hide",
      } as FullscreenOptions);
    }
  } catch {
    // iOS Safari does not support fullscreen for normal web pages.
  }
}

export default function BattleAppLauncher({
  mode = "page",
}: {
  mode?: "page" | "button";
}) {
  const router = useRouter();
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<InstallState>("loading");
  const [open, setOpen] = useState(mode === "page");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const registerServiceWorker = async () => {
      if (!("serviceWorker" in navigator)) return;

      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        return;
      }
    };

    const syncInstallState = () => {
      if (isStandaloneMode()) {
        setInstallState("installed");
        return;
      }

      setInstallState(isIosDevice() ? "ios" : "fallback");
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      promptRef.current = promptEvent;
      setInstallState("ready");
    };

    const handleInstalled = () => {
      promptRef.current = null;
      setInstallState("installed");
    };

    void registerServiceWorker();
    syncInstallState();

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt as EventListener
    );
    window.addEventListener("appinstalled", handleInstalled);

    const fallbackTimer = window.setTimeout(() => {
      setInstallState((current) =>
        current === "loading" ? (isIosDevice() ? "ios" : "fallback") : current
      );
    }, 900);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt as EventListener
      );
      window.removeEventListener("appinstalled", handleInstalled);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  useEffect(() => {
    if (mode === "page") {
      setOpen(true);
    }
  }, [mode]);

  useEffect(() => {
    if (!open || mode === "page" || typeof window === "undefined") return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [mode, open]);

  const installApp = async () => {
    const deferredPrompt = promptRef.current;

    if (deferredPrompt) {
      promptRef.current = null;

      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice?.outcome === "accepted") {
          setInstallState("installed");
          return;
        }
      } catch {
        // Keep the manual guide visible.
      }
    }

    setInstallState(isIosDevice() ? "ios" : "fallback");
  };

  const enterGame = async () => {
    if (busy) return;

    setBusy(true);
    await requestGameViewport();
    router.push("/battle/triad-dominion");
  };

  const installLabel =
    installState === "installed"
      ? "Installed"
      : installState === "ready"
        ? "Install game app"
        : isIosDevice()
          ? "iPhone setup"
          : "App setup";

  const launcher = (
    <section className="relative mx-auto flex h-full min-h-[100dvh] w-full max-w-[1180px] flex-col justify-center overflow-hidden bg-[#050507] px-4 py-[max(16px,env(safe-area-inset-top))] pb-[max(18px,env(safe-area-inset-bottom))] text-white sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(251,191,36,0.16),transparent_28%),radial-gradient(circle_at_88%_86%,rgba(14,165,233,0.12),transparent_30%),linear-gradient(135deg,#050507_0%,#080b12_48%,#030405_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.18)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative grid min-h-0 gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/22 bg-amber-300/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">
            <Swords className="h-4 w-4" />
            NEXORA Battle Card
          </div>

          <div>
            <h1 className="text-[clamp(2.15rem,8vw,5.8rem)] font-black uppercase leading-[0.86] tracking-normal">
              Game Mode
            </h1>
            <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-white/68 sm:text-base">
              เล่นแบบเต็มจอให้ใกล้แอพที่สุด Android ติดตั้งได้ทันทีเมื่อระบบรองรับ ส่วน iPhone ให้ Add to Home Screen แล้วเปิดจากไอคอนเพื่อซ่อน browser chrome.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["Fullscreen", "ซ่อนหัวเว็บและแถบนำทาง"],
              ["Landscape", "สนามจัดเป็นแนวนอน"],
              ["Touch Ready", "แตะ/ปัดแทนคลิก"],
            ].map(([title, body]) => (
              <div
                key={title}
                className="rounded-[8px] border border-white/8 bg-white/[0.045] p-3"
              >
                <div className="text-xs font-black uppercase tracking-[0.14em] text-white">
                  {title}
                </div>
                <div className="mt-1 text-[11px] font-semibold leading-5 text-white/52">
                  {body}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[8px] border border-white/10 bg-black/36 p-3 shadow-[0_30px_120px_rgba(0,0,0,0.46)]">
          <div className="absolute inset-0 bg-[linear-gradient(130deg,rgba(251,191,36,0.12),transparent_34%,rgba(14,165,233,0.10))]" />
          <div className="relative grid gap-3">
            <button
              type="button"
              onClick={enterGame}
              disabled={busy}
              className="group flex min-h-16 items-center justify-between rounded-[8px] border border-amber-300/35 bg-[linear-gradient(180deg,#facc15,#d97706)] px-4 py-4 text-left text-black shadow-[0_22px_60px_rgba(245,158,11,0.22)] transition active:scale-[0.99] disabled:opacity-70"
            >
              <div className="min-w-0">
                <div className="text-lg font-black uppercase tracking-normal">
                  {busy ? "Opening arena..." : "Enter fullscreen battle"}
                </div>
                <div className="mt-1 text-xs font-black text-black/64">
                  ขอ fullscreen/landscape ก่อนเข้าเกม
                </div>
              </div>
              <Maximize2 className="h-6 w-6 shrink-0" />
            </button>

            <button
              type="button"
              onClick={installApp}
              className="flex min-h-14 items-center justify-between rounded-[8px] border border-white/10 bg-white/[0.06] px-4 py-3 text-left transition hover:bg-white/[0.09] active:scale-[0.99]"
            >
              <div className="min-w-0">
                <div className="text-sm font-black uppercase tracking-[0.08em]">
                  {installLabel}
                </div>
                <div className="mt-1 text-xs font-semibold text-white/54">
                  {installState === "installed"
                    ? "เปิดจากไอคอนบนเครื่องเพื่อฟีลแอพเต็มจอ"
                    : installState === "ready"
                      ? "Android/Chrome พร้อมติดตั้งเป็นแอพ"
                      : isIosDevice()
                        ? "Safari: Share > Add to Home Screen"
                        : "ถ้า prompt ยังไม่ขึ้น ใช้เมนู Install app ของ browser"}
                </div>
              </div>
              {installState === "installed" ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
              ) : (
                <Download className="h-5 w-5 shrink-0 text-amber-200" />
              )}
            </button>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-[8px] border border-sky-300/14 bg-sky-300/8 p-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-sky-100">
                  <Smartphone className="h-4 w-4" />
                  Android
                </div>
                <div className="mt-2 text-xs font-semibold leading-5 text-white/58">
                  กด Install game app แล้วเปิดจากไอคอน จะได้หน้าต่างแยกเต็มจอเหมือนเกม.
                </div>
              </div>
              <div className="rounded-[8px] border border-white/10 bg-white/[0.045] p-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-white">
                  <Share className="h-4 w-4" />
                  iPhone
                </div>
                <div className="mt-2 text-xs font-semibold leading-5 text-white/58">
                  Safari กด Share <Plus className="mx-1 inline h-3.5 w-3.5" /> Add to Home Screen แล้วเข้าเกมจากไอคอน.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-[8px] border border-white/8 bg-black/30 px-3 py-2 text-[11px] font-semibold leading-5 text-white/48">
              <MonitorSmartphone className="h-4 w-4 shrink-0 text-white/38" />
              Browser ปกติยังมีข้อจำกัดของ iOS/Chrome แต่สนาม Battle จะซ่อน header/nav ของเว็บทั้งหมดเมื่อเข้าเกม.
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  if (mode === "page") {
    return launcher;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#10141c] px-5 py-3 text-sm font-black text-white shadow-[0_18px_34px_rgba(0,0,0,0.18)] ring-1 ring-black/10 transition hover:scale-[1.03] hover:bg-black active:scale-[0.98]"
      >
        <Swords className="h-4 w-4 text-amber-300" />
        BATTLE CARD
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[2600] bg-[#050507]"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 backdrop-blur-xl transition hover:bg-white/[0.1] hover:text-white"
            aria-label="Close battle launcher"
          >
            <X className="h-5 w-5" />
          </button>
          {launcher}
        </div>
      ) : null}
    </>
  );
}
