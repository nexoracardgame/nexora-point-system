"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  Radio,
  Send,
  ShieldCheck,
  Square,
  Tv2,
} from "lucide-react";

type ActiveLive = {
  id: string;
  platform: "youtube" | "facebook" | "tiktok";
  sourceUrl: string;
  embedUrl: string;
  title: string;
  ownerUserId: string;
  ownerName: string;
  createdAt: string;
};

const LIVE_STATUS_EVENT = "nexora:live-status-updated";
const LIVE_STATUS_STORAGE_KEY = "nexora:live-status-version";

const platformHints = [
  {
    name: "YouTube",
    detail: "รองรับดีที่สุด เหมาะกับไลฟ์ยาวและเปิดเสียงจาก player ได้ง่าย",
  },
  {
    name: "Facebook",
    detail: "ใช้ตัวฝังของ Facebook ระบบจะซิงก์หน้าจอลอยให้ทุกคนทันที",
  },
  {
    name: "TikTok",
    detail: "รองรับแบบ best effort หากแพลตฟอร์มบล็อก iframe จะมีปุ่มเปิดต้นทาง",
  },
];

function platformLabel(platform: ActiveLive["platform"]) {
  if (platform === "youtube") return "YouTube";
  if (platform === "facebook") return "Facebook";
  return "TikTok";
}

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function forceSoundUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname.includes("facebook.com")) {
      url.searchParams.set("mute", "false");
    } else {
      url.searchParams.set("mute", "0");
    }
    url.searchParams.set("autoplay", "1");
    url.searchParams.set("playsinline", "1");
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function broadcastLiveStatusChanged() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(LIVE_STATUS_EVENT));

  try {
    window.localStorage.setItem(LIVE_STATUS_STORAGE_KEY, String(Date.now()));
  } catch {
    return;
  }
}

export default function LiveControlClient() {
  const { data: session } = useSession();
  const [url, setUrl] = useState("");
  const [active, setActive] = useState<ActiveLive | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const hasActiveLive = !!active;
  const isTikTokLive = active?.platform === "tiktok";

  const canStop = useMemo(() => {
    const role = String(session?.user?.role || "").toLowerCase();
    return (
      !!active &&
      (active.ownerUserId === session?.user?.id ||
        role === "admin" ||
        role === "staff" ||
        role === "superadmin")
    );
  }, [active, session?.user?.id, session?.user?.role]);

  const loadActive = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const res = await fetch(`/api/live?ts=${Date.now()}`, {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => null)) as {
        active?: ActiveLive | null;
      } | null;

      if (res.ok) {
        setActive(payload?.active || null);
      }
    } catch {
      if (!silent) {
        setError("โหลดสถานะไลฟ์ไม่สำเร็จ ลองรีเฟรชอีกครั้ง");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      if (!cancelled && document.visibilityState === "visible") {
        void loadActive(true);
      }
    };

    void loadActive(false);
    const intervalId = window.setInterval(tick, hasActiveLive ? 700 : 1600);
    const handleFocus = () => tick();
    const handleVisibility = () => tick();
    const handleLiveStatus = () => tick();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LIVE_STATUS_STORAGE_KEY) {
        tick();
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener(LIVE_STATUS_EVENT, handleLiveStatus);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(LIVE_STATUS_EVENT, handleLiveStatus);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [hasActiveLive, loadActive]);

  async function startLive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await res.json().catch(() => null)) as {
        active?: ActiveLive | null;
        error?: string;
      } | null;

      if (res.status === 409) {
        setActive(payload?.active || null);
        setError("ตอนนี้มีคนกำลังแชร์ไลฟ์อยู่ ต้องรอให้ปิดก่อนถึงเริ่มใหม่ได้");
        return;
      }

      if (!res.ok) {
        setError(
          payload?.error === "unsupported_platform"
            ? "รองรับเฉพาะลิงก์ไลฟ์จาก YouTube, Facebook และ TikTok"
            : "เริ่มแชร์ไลฟ์ไม่สำเร็จ ตรวจลิงก์แล้วลองอีกครั้ง"
        );
        return;
      }

      setActive(payload?.active || null);
      setUrl("");
      broadcastLiveStatusChanged();
      setMessage("เริ่มแชร์ไลฟ์แล้ว ทุกเครื่องจะเห็นหน้าจอลอยอัตโนมัติ");
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  async function stopLive() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/live", { method: "DELETE" });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok) {
        setError(
          payload?.error === "forbidden"
            ? "ปิดไลฟ์ได้เฉพาะเจ้าของไลฟ์หรือแอดมินเท่านั้น"
            : "ปิดไลฟ์ไม่สำเร็จ ลองอีกครั้ง"
        );
        return;
      }

      setActive(null);
      broadcastLiveStatusChanged();
      void loadActive(true);
      setMessage("ปิดไลฟ์แล้ว หน้าจอลอยจะหายจากทุกเครื่อง");
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-[calc(var(--app-shell-height)-var(--app-desktop-chrome-height))] overflow-hidden rounded-[28px] bg-[#f5f1eb] text-black shadow-[0_24px_80px_rgba(0,0,0,0.16)]">
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.92),transparent_34%),linear-gradient(135deg,#ffffff_0%,#efe8df_48%,#d8d2ca_100%)]" />
        <div className="absolute inset-0 -z-10 opacity-[0.18] [background-image:linear-gradient(rgba(0,0,0,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.22)_1px,transparent_1px)] [background-size:34px_34px]" />

        <section className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.7fr)] xl:p-8">
          <div className="rounded-[26px] bg-black p-5 text-white shadow-[0_28px_90px_rgba(0,0,0,0.28)] sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-amber-300">
                  <Radio className="h-4 w-4" />
                  Live Control
                </div>
                <h1 className="mt-3 max-w-3xl text-3xl font-black leading-[0.98] tracking-[-0.03em] sm:text-5xl xl:text-6xl">
                  ห้องควบคุมแชร์ไลฟ์สด
                </h1>
              </div>

              <div className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-black text-white/80">
                ใช้งานได้ทีละ 1 ไลฟ์
              </div>
            </div>

            <p className="mt-5 max-w-2xl text-sm font-bold leading-7 text-white/64 sm:text-base">
              วางลิงก์ไลฟ์จาก YouTube, Facebook หรือ TikTok ระบบจะส่งหน้าจอลอยไปให้ทุกคนในแอพแบบเรียลไทม์ และเปิดเสียงไว้ตั้งแต่แรกทุกแพลตฟอร์ม
            </p>

            <form onSubmit={startLive} className="mt-7 space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-3 sm:p-4">
                <label className="mb-3 block text-[11px] font-black uppercase tracking-[0.22em] text-white/45">
                  Live URL
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    disabled={!!active || saving}
                    placeholder="วางลิงก์ไลฟ์สดที่นี่"
                    className="min-h-[52px] min-w-0 flex-1 rounded-[18px] border border-white/10 bg-black px-4 text-base font-bold text-white outline-none transition placeholder:text-white/28 focus:border-amber-300/40 focus:ring-4 focus:ring-amber-300/10 disabled:cursor-not-allowed disabled:opacity-45"
                  />
                  <button
                    type="submit"
                    disabled={!url.trim() || !!active || saving}
                    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[18px] bg-white px-5 text-sm font-black text-black shadow-[0_14px_34px_rgba(255,255,255,0.12)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    เริ่มแชร์
                  </button>
                </div>
              </div>

              {active && (
                <div className="flex items-start gap-3 rounded-[22px] border border-amber-300/22 bg-amber-300/12 p-4 text-amber-50">
                  <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
                  <div className="min-w-0">
                    <div className="font-black">ช่องไลฟ์ถูกใช้งานอยู่</div>
                    <div className="mt-1 text-sm font-bold text-amber-50/70">
                      {platformLabel(active.platform)} โดย {active.ownerName} เริ่มเมื่อ {formatTime(active.createdAt)}
                    </div>
                  </div>
                </div>
              )}

              {message && (
                <div className="flex items-center gap-3 rounded-[18px] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
                  <CheckCircle2 className="h-4 w-4" />
                  {message}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-3 rounded-[18px] border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </form>
          </div>

          <aside className="rounded-[26px] border border-black/8 bg-white/82 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.12)] backdrop-blur-xl sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-black/38">
                  Broadcast Status
                </div>
                <h2 className="mt-1 text-2xl font-black">สถานะปัจจุบัน</h2>
              </div>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-black/45" />
              ) : active ? (
                <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-black text-white">
                  LIVE
                </span>
              ) : (
                <span className="rounded-full bg-black px-3 py-1 text-xs font-black text-white">
                  READY
                </span>
              )}
            </div>

            {active ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-[22px] bg-black">
                  <div
                    className={
                      isTikTokLive
                        ? "relative mx-auto aspect-[9/16] max-h-[62vh] w-full max-w-[360px]"
                        : "relative aspect-video"
                    }
                  >
                    <iframe
                      src={forceSoundUrl(active.embedUrl)}
                      title={active.title}
                      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                      allowFullScreen
                      className="h-full w-full"
                    />
                    {isTikTokLive ? (
                      <a
                        href={active.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-3 left-3 right-3 rounded-2xl border border-white/10 bg-black/74 px-3 py-2 text-center text-[11px] font-black text-white shadow-[0_18px_36px_rgba(0,0,0,0.4)] backdrop-blur-xl transition hover:bg-black"
                      >
                        หาก TikTok บล็อก iframe แตะเพื่อเปิดไลฟ์ต้นทาง
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[22px] bg-[#f2eee8] p-4">
                  <div className="text-sm font-black">
                    {platformLabel(active.platform)} Live
                  </div>
                  <div className="mt-1 text-sm font-bold text-black/55">
                    เจ้าของ: {active.ownerName}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={active.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-black text-white"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      เปิดต้นทาง
                    </a>
                    {canStop && (
                      <button
                        type="button"
                        onClick={stopLive}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-xs font-black text-white transition hover:bg-red-600 disabled:opacity-50"
                      >
                        {saving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Square className="h-3.5 w-3.5 fill-current" />
                        )}
                        ปิดไลฟ์
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[280px] items-center justify-center rounded-[24px] border border-dashed border-black/12 bg-[#f6f2ed] p-6 text-center">
                <div>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-black text-white shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
                    <Tv2 className="h-7 w-7" />
                  </div>
                  <div className="mt-5 text-xl font-black">พร้อมแชร์ไลฟ์</div>
                  <p className="mt-2 max-w-sm text-sm font-bold leading-6 text-black/48">
                    เมื่อเริ่มแชร์ หน้าจอลอยจะขึ้นมุมขวาล่างบนคอม และลอยเหนือเมนูในมือถือทันที
                  </p>
                </div>
              </div>
            )}
          </aside>
        </section>

        <section className="grid gap-3 px-4 pb-5 sm:grid-cols-3 sm:px-6 xl:px-8 xl:pb-8">
          {platformHints.map((item) => (
            <div
              key={item.name}
              className="rounded-[22px] border border-black/8 bg-white/76 p-4 shadow-[0_14px_36px_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-center gap-2 text-sm font-black">
                <ShieldCheck className="h-4 w-4 text-amber-600" />
                {item.name}
              </div>
              <p className="mt-2 text-sm font-bold leading-6 text-black/52">
                {item.detail}
              </p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
