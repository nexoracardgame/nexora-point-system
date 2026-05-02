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

export default function AppInstallButton({
  variant = "dark",
}: {
  variant?: "dark" | "light";
}) {
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

  useEffect(() => {
    if (!guideOpen || typeof window === "undefined") return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setGuideOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [guideOpen]);

  const handleInstall = async () => {
    if (installState === "installed") {
      return;
    }

    if (isIosDevice()) {
      setInstallState("ios");
      setGuideOpen(true);
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

  const isLight = variant === "light";

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className={`pointer-events-auto group relative flex w-full max-w-[360px] items-center justify-between gap-4 overflow-hidden rounded-[26px] px-4 py-3.5 text-left shadow-[0_24px_60px_rgba(0,0,0,0.18),0_0_30px_rgba(250,204,21,0.08)] backdrop-blur-2xl transition duration-300 hover:-translate-y-0.5 sm:px-5 sm:py-4 ${
          isLight
            ? "border border-black/10 bg-white/92 text-black hover:border-amber-500/45 hover:shadow-[0_30px_70px_rgba(0,0,0,0.14),0_0_40px_rgba(250,204,21,0.12)]"
            : "border border-white/10 bg-[linear-gradient(180deg,rgba(8,9,12,0.96),rgba(2,2,4,0.98))] text-white hover:border-white/20 hover:shadow-[0_30px_70px_rgba(0,0,0,0.42),0_0_40px_rgba(255,255,255,0.06)]"
        }`}
      >
        <div
          className={`pointer-events-none absolute inset-0 ${
            isLight
              ? "bg-[linear-gradient(125deg,rgba(250,204,21,0.16),transparent_34%,transparent_72%,rgba(0,0,0,0.04))]"
              : "bg-[linear-gradient(125deg,rgba(255,255,255,0.10),transparent_26%,transparent_70%,rgba(250,204,21,0.14))]"
          }`}
        />
        <div className="relative flex min-w-0 items-center gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${
              isLight
                ? "border border-black/8 bg-black/[0.03] text-amber-600"
                : "border border-white/10 bg-white/[0.06] text-amber-200"
            }`}
          >
            {installState === "installed" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <Download className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0">
            <div
            className={`truncate text-sm font-black uppercase tracking-[0.12em] sm:text-[15px] ${
                isLight ? "text-black" : "text-white"
              }`}
            >
              {title}
            </div>
            <div
              className={`mt-1 text-[11px] font-semibold leading-5 sm:text-xs ${
                isLight ? "text-black/58" : "text-white/72"
              }`}
            >
              {caption}
            </div>
          </div>
        </div>

        <div
          className={`relative flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] ${
            isLight
              ? "border border-black/8 bg-black/[0.03] text-black/76"
              : "border border-white/12 bg-white text-black"
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" />
          แอพ
        </div>
      </button>

      {guideOpen ? (
        <div
          className="pointer-events-auto fixed inset-0 z-[2400] flex items-center justify-center overflow-hidden bg-black/82 px-3 py-[max(14px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))] backdrop-blur-xl sm:p-6"
          onClick={() => setGuideOpen(false)}
          role="presentation"
        >
          <div
            className="flex max-h-[min(720px,calc(100svh-32px))] w-full max-w-[430px] flex-col overflow-hidden rounded-[28px] border border-white/12 bg-[#070a10] text-white shadow-[0_32px_120px_rgba(0,0,0,0.72)] ring-1 ring-amber-200/8 sm:max-h-[min(86dvh,720px)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/8 px-4 py-4 sm:px-5">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-300/85 sm:text-xs">
                  ติดตั้งแอพ
                </div>
                <div className="mt-1 text-[clamp(1.25rem,6vw,1.85rem)] font-black leading-tight">
                  {isIosDevice()
                    ? "เพิ่ม NEXORA ลงหน้าจอโฮม"
                    : "ติดตั้งแอพจากเบราว์เซอร์"}
                </div>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setGuideOpen(false);
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/72 transition hover:bg-white/[0.1] hover:text-white"
                aria-label="Close install guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 text-sm text-white/78 sm:px-5 sm:py-5">
              <div className="rounded-[20px] border border-amber-300/14 bg-amber-300/10 px-4 py-3 text-[13px] font-semibold leading-6 text-amber-100/88">
                ถ้าอุปกรณ์รองรับ ระบบจะเปิดหน้าต่างติดตั้งให้อัตโนมัติทันที
                หากเบราว์เซอร์ยังไม่แสดง prompt ให้ทำตามขั้นตอนด้านล่างได้เลย
              </div>
              {isIosDevice() ? (
                <>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.045] p-4 text-[13px] font-semibold leading-6 text-white/66">
                    iPhone และ iPad ยังไม่อนุญาตให้เว็บสั่งติดตั้งแอพเองแบบ
                    Android ระบบจึงพาไปขั้นตอนติดตั้งที่ iOS รองรับโดยตรง
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.045] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-amber-200">
                        <ArrowUpFromLine className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-black text-white">
                          1. แตะปุ่ม Share ใน Safari
                        </div>
                        <div className="mt-1 text-xs text-white/58">
                          ใช้เมนูแชร์ด้านล่างหรือด้านบนของเบราว์เซอร์
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.045] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-amber-200">
                        <Plus className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
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
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.045] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-amber-200">
                        <ArrowDownToLine className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-black text-white">
                          กดเมนู Install app ของเบราว์เซอร์
                        </div>
                        <div className="mt-1 text-xs text-white/58">
                          Chrome และเบราว์เซอร์สาย Chromium จะติดตั้งลงเครื่องได้ทันที
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.045] p-4 text-xs leading-5 text-white/62">
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
