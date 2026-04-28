"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Download,
  Plus,
  Smartphone,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

type InstallState = "loading" | "ready" | "ios" | "fallback" | "installed";

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

export default function AppInstallButton() {
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<InstallState>("loading");
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const registerServiceWorker = async () => {
      if (!("serviceWorker" in navigator)) return;

      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
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
      setGuideOpen(false);
      setInstallState("installed");
    };

    void registerServiceWorker();
    syncInstallState();

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt as EventListener
    );
    window.addEventListener("appinstalled", handleInstalled);

    const stateTimeout = window.setTimeout(() => {
      setInstallState((current) => {
        if (current === "loading") {
          return isIosDevice() ? "ios" : "fallback";
        }

        return current;
      });
    }, 1200);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt as EventListener
      );
      window.removeEventListener("appinstalled", handleInstalled);
      window.clearTimeout(stateTimeout);
    };
  }, []);

  const handleInstall = async () => {
    if (installState === "installed") {
      return;
    }

    const deferredPrompt = promptRef.current;
    if (deferredPrompt) {
      promptRef.current = null;

      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;

        if (choice?.outcome === "accepted") {
          setInstallState("installed");
          setGuideOpen(false);
          return;
        }
      } catch {
        // Fall through to guide state.
      }
    }

    setGuideOpen(true);
    setInstallState(isIosDevice() ? "ios" : "fallback");
  };

  const title =
    installState === "installed"
      ? "ติดตั้งแล้ว"
      : installState === "ready"
        ? "ติดตั้งแอพ NEXORA"
        : installState === "ios"
          ? "ติดตั้งบน iPhone / iPad"
          : "ดาวน์โหลดแอพ NEXORA";

  const caption =
    installState === "installed"
      ? "เปิดจากไอคอนบนเครื่องได้เลย"
      : installState === "ready"
        ? "แตะครั้งเดียวแล้วติดตั้งลงเครื่อง"
        : installState === "ios"
          ? "แตะปุ่มนี้เพื่อดูขั้นตอนเพิ่มลงหน้าจอโฮม"
          : "รองรับ Android, iPhone, iPad และ Desktop";

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className="group relative flex w-full max-w-[360px] items-center justify-between gap-4 overflow-hidden rounded-[26px] border border-white/12 bg-[#0b0f16]/88 px-4 py-3.5 text-left text-white shadow-[0_24px_60px_rgba(0,0,0,0.38),0_0_30px_rgba(250,204,21,0.12)] backdrop-blur-2xl transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/40 hover:shadow-[0_30px_70px_rgba(0,0,0,0.42),0_0_40px_rgba(250,204,21,0.18)] sm:px-5 sm:py-4"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(250,204,21,0.22),transparent_30%,transparent_72%,rgba(255,255,255,0.08))]" />
        <div className="relative flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.06] text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            {installState === "installed" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <Download className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm font-black uppercase tracking-[0.12em] text-white sm:text-[15px]">
              {title}
            </div>
            <div className="mt-1 text-[11px] font-semibold leading-5 text-white/65 sm:text-xs">
              {caption}
            </div>
          </div>
        </div>

        <div className="relative flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/82">
          <Smartphone className="h-3.5 w-3.5" />
          APP
        </div>
      </button>

      {guideOpen ? (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/55 p-4 backdrop-blur-md sm:items-center">
          <div className="w-full max-w-[420px] overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1118]/98 text-white shadow-[0_28px_90px_rgba(0,0,0,0.48)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-amber-300/85">
                  Install App
                </div>
                <div className="mt-1 text-xl font-black">
                  {isIosDevice()
                    ? "เพิ่ม NEXORA ลงหน้าจอโฮม"
                    : "ติดตั้งแอพจากเบราว์เซอร์"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="rounded-full border border-white/10 bg-white/[0.05] p-2 text-white/72 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="Close install guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-5 text-sm text-white/78">
              {isIosDevice() ? (
                <>
                  <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.05] text-amber-200">
                        <ArrowUpFromLine className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="font-black text-white">
                          1. แตะปุ่ม Share ใน Safari
                        </div>
                        <div className="mt-1 text-xs text-white/58">
                          ใช้เมนูแชร์ด้านล่างหรือด้านบนของเบราว์เซอร์
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.05] text-amber-200">
                        <Plus className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="font-black text-white">
                          2. เลือก Add to Home Screen
                        </div>
                        <div className="mt-1 text-xs text-white/58">
                          จากนั้นกดยืนยัน Add แอพจะไปอยู่บนเครื่องทันที
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.05] text-amber-200">
                        <ArrowDownToLine className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="font-black text-white">
                          กดเมนู Install app ของเบราว์เซอร์
                        </div>
                        <div className="mt-1 text-xs text-white/58">
                          Chrome และเบราว์เซอร์สาย Chromium จะติดตั้งลงเครื่องได้ทันที
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-xs text-white/58">
                    ถ้ายังไม่เห็น prompt ให้รีเฟรชหนึ่งครั้งหลังหน้าโหลดครบ แล้วแตะปุ่มนี้อีกที
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
