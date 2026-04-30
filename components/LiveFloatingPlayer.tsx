"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  Maximize2,
  Minimize2,
  Radio,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

type ActiveLive = {
  id: string;
  platform: "youtube" | "facebook" | "tiktok";
  sourceUrl: string;
  embedUrl: string;
  title: string;
  ownerName: string;
  createdAt: string;
};

function platformLabel(platform: ActiveLive["platform"]) {
  if (platform === "youtube") return "YouTube";
  if (platform === "facebook") return "Facebook";
  return "TikTok";
}

function setMuteParam(rawUrl: string, muted: boolean) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname.includes("facebook.com")) {
      url.searchParams.set("mute", muted ? "true" : "false");
    } else {
      url.searchParams.set("mute", muted ? "1" : "0");
    }
    url.searchParams.set("autoplay", "1");
    url.searchParams.set("playsinline", "1");
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export default function LiveFloatingPlayer() {
  const pathname = usePathname();
  const [active, setActive] = useState<ActiveLive | null>(null);
  const [hiddenLiveId, setHiddenLiveId] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [muted, setMuted] = useState(true);
  const lastActiveIdRef = useRef("");

  const loadActive = useCallback(async () => {
    try {
      const res = await fetch(`/api/live?ts=${Date.now()}`, {
        cache: "no-store",
      });

      if (!res.ok) return;

      const payload = (await res.json().catch(() => null)) as {
        active?: ActiveLive | null;
      } | null;

      const nextActive = payload?.active || null;
      setActive(nextActive);

      if (nextActive?.id && nextActive.id !== lastActiveIdRef.current) {
        lastActiveIdRef.current = nextActive.id;
        setHiddenLiveId("");
        setCollapsed(false);
        setMuted(true);
      }

      if (!nextActive) {
        lastActiveIdRef.current = "";
        setHiddenLiveId("");
        setCollapsed(false);
        setMuted(true);
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      if (!cancelled && document.visibilityState === "visible") {
        void loadActive();
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 2200);
    const handleFocus = () => tick();
    const handleVisibility = () => tick();

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadActive]);

  const playerSrc = useMemo(() => {
    if (!active) return "";
    return setMuteParam(active.embedUrl, muted);
  }, [active, muted]);

  if (!active || hiddenLiveId === active.id || pathname.startsWith("/live")) {
    return null;
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+104px)] right-3 z-[1090] flex max-w-[calc(100vw-24px)] items-center gap-2 rounded-full border border-white/12 bg-black/88 px-4 py-3 text-left text-white shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-2xl xl:bottom-6 xl:right-6"
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white shadow-[0_0_24px_rgba(239,68,68,0.45)]">
          <Radio className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-black bg-red-300" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-black">
            กำลังไลฟ์สด
          </span>
          <span className="block truncate text-[11px] font-bold text-white/55">
            {platformLabel(active.platform)} โดย {active.ownerName}
          </span>
        </span>
      </button>
    );
  }

  return (
    <section className="fixed bottom-[calc(env(safe-area-inset-bottom)+104px)] left-3 right-3 z-[1090] overflow-hidden rounded-[24px] border border-white/12 bg-black/92 text-white shadow-[0_26px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:left-auto sm:w-[440px] xl:bottom-6 xl:right-6 xl:w-[560px]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.85)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-red-200">
              Live Now
            </span>
          </div>
          <div className="mt-1 truncate text-sm font-black sm:text-base">
            {platformLabel(active.platform)} โดย {active.ownerName}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition hover:bg-white/[0.1]"
            aria-label={muted ? "เปิดเสียง" : "ปิดเสียง"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <a
            href={active.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition hover:bg-white/[0.1]"
            aria-label="เปิดต้นทาง"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition hover:bg-white/[0.1]"
            aria-label="ย่อ"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setHiddenLiveId(active.id)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition hover:bg-red-500/20"
            aria-label="ซ่อน"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative aspect-video w-full bg-[#060608]">
        <iframe
          key={`${active.id}-${muted ? "muted" : "sound"}`}
          src={playerSrc}
          title={active.title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="h-full w-full"
        />

        <div className="pointer-events-none absolute bottom-3 right-3 hidden items-center gap-2 rounded-full border border-white/10 bg-black/52 px-3 py-2 text-[11px] font-bold text-white/80 sm:flex">
          <Maximize2 className="h-3.5 w-3.5" />
          หน้าจอลอย
        </div>
      </div>
    </section>
  );
}
