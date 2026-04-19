"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { getLocaleTag, useLanguage } from "@/lib/i18n";
import {
  Bell,
  Heart,
  Handshake,
  MessageCircle,
  ChevronRight,
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type NotificationItem = {
  id: string;
  type: "chat" | "deal" | "wishlist";
  title: string;
  body: string;
  href: string;
  image: string;
  createdAt: string;
};

type NotificationResponse = {
  items: NotificationItem[];
};

function formatNotificationTime(
  dateString: string,
  localeTag: string,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return t("notifications.justNow");
  if (diffMinutes < 60) return t("notifications.minutes", { count: diffMinutes });
  if (diffHours < 24) return t("notifications.hours", { count: diffHours });
  if (diffDays < 7) return t("notifications.days", { count: diffDays });

  return date.toLocaleDateString(localeTag, {
    day: "numeric",
    month: "short",
  });
}

function getNotificationIcon(type: NotificationItem["type"]) {
  switch (type) {
    case "chat":
      return MessageCircle;
    case "deal":
      return Handshake;
    default:
      return Heart;
  }
}

export default function NotificationBell() {
  const { locale, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const storageKey = "nexora_notification_seen_items";
  const [seenMap, setSeenMap] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};

    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, boolean>)
        : {};
    } catch {
      return {};
    }
  });

  const localeTag = getLocaleTag(locale);

  const persistSeenMap = (nextMap: Record<string, boolean>) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(nextMap));
  };

  const markSeen = (notificationId: string) => {
    if (!notificationId) return;

    setSeenMap((prev) => {
      if (prev[notificationId]) return prev;
      const next = {
        ...prev,
        [notificationId]: true,
      };
      persistSeenMap(next);
      return next;
    });
  };

  const loadNotifications = async () => {
    try {
      const res = await fetch("/api/notifications", {
        cache: "no-store",
      });

      const data = (await res.json()) as NotificationResponse;
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      return;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 10000);

    const onFocus = () => {
      void loadNotifications();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadNotifications();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`notification-bell-${Date.now()}`);

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dmMessage" },
      () => {
        void loadNotifications();
      }
    );

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dm_room" },
      () => {
        void loadNotifications();
      }
    );

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dealRequest" },
      () => {
        void loadNotifications();
      }
    );

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "marketHistory" },
      () => {
        void loadNotifications();
      }
    );

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("click", onClickOutside);
    return () => window.removeEventListener("click", onClickOutside);
  }, []);

  const unreadItems = useMemo(
    () => items.filter((item) => !seenMap[item.id]),
    [items, seenMap]
  );

  const totalUnreadCount = unreadItems.length;

  return (
    <div className="relative z-[700]" ref={wrapRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-amber-300 transition hover:bg-white/[0.06] hover:shadow-[0_0_18px_rgba(251,191,36,0.14)]"
      >
        <Bell className="h-4 w-4" />

        {totalUnreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-[20px] rounded-full border border-red-300/40 bg-[radial-gradient(circle_at_top,#ff7b7b,#ef4444_60%,#b91c1c)] px-1.5 py-0.5 text-center text-[10px] font-black text-white shadow-[0_0_20px_rgba(239,68,68,0.45)]">
            {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[1390] bg-black/35 backdrop-blur-[2px] sm:hidden"
          />
          <div className="fixed inset-x-3 top-[84px] z-[1400] max-h-[min(76vh,680px)] overflow-hidden rounded-[28px] border border-white/10 bg-[#0f1117]/96 shadow-[0_30px_120px_rgba(0,0,0,0.58),0_0_40px_rgba(251,191,36,0.08)] backdrop-blur-2xl sm:absolute sm:right-0 sm:top-[calc(100%+14px)] sm:left-auto sm:w-[420px]">
            <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_55%)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/40">
                    {t("notifications.center")}
                  </div>
                  <div className="mt-1 text-lg font-black text-white">
                    {t("notifications.recent")}
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-300/16 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.12)]">
                  {t("notifications.new", { count: totalUnreadCount })}
                </div>
              </div>
            </div>

            <div className="max-h-[calc(min(76vh,680px)-82px)] overflow-y-auto px-2 py-2">
              {loading && (
                <div className="px-3 py-5 text-sm text-white/45">
                  {t("notifications.loading")}
                </div>
              )}

              {!loading && unreadItems.length === 0 && (
                <div className="px-3 py-10 text-center text-sm text-white/45">
                  {t("notifications.empty")}
                </div>
              )}

              {unreadItems.map((item) => {
                const Icon = getNotificationIcon(item.type);

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => {
                      markSeen(item.id);
                      setOpen(false);
                    }}
                    className="group flex items-start gap-3 rounded-[22px] border border-transparent px-3 py-3 transition hover:border-amber-300/10 hover:bg-white/[0.03]"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-12 w-12 rounded-2xl object-cover ring-1 ring-white/10"
                      />
                      <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-black/30 bg-[#111318] text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.16)]">
                        <Icon className="h-3 w-3" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="line-clamp-1 text-sm font-black text-white">
                          {item.title}
                        </div>
                        <div className="shrink-0 text-[11px] text-white/35">
                          {formatNotificationTime(item.createdAt, localeTag, t)}
                        </div>
                      </div>

                      <div className="mt-1 line-clamp-2 text-sm text-white/62">
                        {item.body}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_14px_rgba(248,113,113,0.75)]" />
                      <ChevronRight className="mt-1 h-4 w-4 text-white/24 transition group-hover:text-white/45" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
