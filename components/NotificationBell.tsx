"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";
import { cacheRealtimeDmMessage } from "@/lib/dm-room-fast-cache";
import { dispatchClientChatRead } from "@/lib/chat-read-sync";
import { getLocaleTag, useLanguage } from "@/lib/i18n";
import { formatThaiShortDate } from "@/lib/thai-time";
import {
  Bell,
  Heart,
  Handshake,
  MessageCircle,
  ChevronRight,
  UserPlus,
  Gift,
} from "lucide-react";

type NotificationItem = {
  id: string;
  type: "chat" | "deal" | "wishlist" | "friend" | "wallet";
  title: string;
  body: string;
  href: string;
  image: string;
  createdAt: string;
  meta?: Record<string, string | number | boolean | null> | null;
};

type NotificationResponse = {
  items: NotificationItem[];
};

type BrowserPushSubscriptionJson = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

const DELIVERED_NOTIFICATION_STORAGE_KEY = "nexora:system-notifications:delivered";
const NOTIFICATION_POLL_TICK_MS = 1000;
const NOTIFICATION_REALTIME_FALLBACK_MS = 15000;
const NOTIFICATION_CONNECTING_FALLBACK_MS = 1800;
const NOTIFICATION_CONFIRM_REFRESH_MS = 550;

function isSystemNotificationSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

function isPushSubscriptionSupported() {
  return (
    isSystemNotificationSupported() &&
    "PushManager" in window &&
    "ServiceWorkerRegistration" in window &&
    "pushManager" in ServiceWorkerRegistration.prototype
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function serializePushSubscription(subscription: PushSubscription) {
  return subscription.toJSON() as BrowserPushSubscriptionJson;
}

function getBrowserClockMs() {
  return typeof performance === "undefined" ? 0 : performance.now();
}

function readDeliveredNotificationIds() {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const raw = window.localStorage.getItem(DELIVERED_NOTIFICATION_STORAGE_KEY);
    if (!raw) {
      return new Set<string>();
    }

    const parsed = JSON.parse(raw) as string[] | null;
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(
      parsed.map((id) => String(id || "").trim()).filter(Boolean)
    );
  } catch {
    return new Set<string>();
  }
}

function writeDeliveredNotificationIds(ids: Set<string>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      DELIVERED_NOTIFICATION_STORAGE_KEY,
      JSON.stringify(Array.from(ids).slice(-240))
    );
  } catch {
    return;
  }
}

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

  return formatThaiShortDate(dateString, localeTag);
}

function getNotificationIcon(type: NotificationItem["type"]) {
  switch (type) {
    case "chat":
      return MessageCircle;
    case "deal":
      return Handshake;
    case "friend":
      return UserPlus;
    case "wallet":
      return Gift;
    default:
      return Heart;
  }
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getChatNotificationRoomId(item: NotificationItem) {
  if (item.type !== "chat") {
    return "";
  }

  const path = String(item.href || "").split("?")[0].split("#")[0];
  const segments = path.split("/").filter(Boolean).map(safeDecode);

  if (segments[0] === "dm" && segments[1]) {
    return segments[1];
  }

  if (
    segments[0] === "market" &&
    segments[1] === "deals" &&
    segments[2] === "chat" &&
    segments[3]
  ) {
    return `deal:${segments[3]}`;
  }

  if (
    segments[0] === "buy-market" &&
    segments[1] === "deals" &&
    segments[2] === "chat" &&
    segments[3]
  ) {
    return `deal:${segments[3]}`;
  }

  return "";
}

function getChatNotificationMessageId(item: NotificationItem) {
  if (item.type !== "chat") {
    return "";
  }

  return String(item.id || "")
    .replace(/^(?:deal-chat|chat)-/, "")
    .trim();
}

function primeChatNotificationCache(item: NotificationItem) {
  if (item.type !== "chat") {
    return;
  }

  const roomId = getChatNotificationRoomId(item);
  const messageId = getChatNotificationMessageId(item);
  if (!roomId || !messageId || roomId.startsWith("deal:")) {
    return;
  }

  cacheRealtimeDmMessage([roomId], {
    id: messageId,
    roomId,
    senderName: item.title,
    senderImage: item.image,
    content: item.body,
    imageUrl: null,
    createdAt: item.createdAt,
    seenAt: null,
  });

  window.dispatchEvent(
    new CustomEvent("nexora:chat-message-received", {
      detail: {
        id: messageId,
        roomId,
        senderName: item.title,
        senderImage: item.image,
        content: item.body,
        imageUrl: null,
        createdAt: item.createdAt,
        seenAt: null,
        source: "notification-cache",
      },
    })
  );
}

function isChatNotificationForRooms(item: NotificationItem, roomIds: Set<string>) {
  if (item.type !== "chat" || roomIds.size === 0) {
    return false;
  }

  return roomIds.has(getChatNotificationRoomId(item));
}

function safeTime(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function isChatNotificationReadByRoom(
  item: NotificationItem,
  readRoomAt: Map<string, string>
) {
  if (item.type !== "chat" || readRoomAt.size === 0) {
    return false;
  }

  const roomId = getChatNotificationRoomId(item);
  const readAt = roomId ? readRoomAt.get(roomId) : "";
  if (!readAt) {
    return false;
  }

  const itemTime = safeTime(item.createdAt);
  const readTime = safeTime(readAt);

  return readTime > 0 && (!itemTime || itemTime <= readTime + 1000);
}

export default function NotificationBell() {
  const pathname = usePathname();
  const { locale, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [fastChatUnreadCount, setFastChatUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const hiddenIdsRef = useRef<Set<string>>(new Set());
  const readRoomAtRef = useRef<Map<string, string>>(new Map());
  const recentReadRoomAtRef = useRef<Map<string, number>>(new Map());
  const deliveredIdsRef = useRef<Set<string>>(new Set());
  const knownIdsRef = useRef<Set<string>>(new Set());
  const hasInitialSyncRef = useRef(false);
  const permissionBootstrapBoundRef = useRef(false);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const pushSubscriptionSyncRef = useRef<Promise<void> | null>(null);
  const pushSubscriptionReadyRef = useRef(false);
  const burstTimeoutsRef = useRef<number[]>([]);
  const lastNotificationLoadAtRef = useRef(0);
  const realtimeConnectedRef = useRef(false);
  const fastChatUnreadCountRef = useRef(0);
  const localeTag = getLocaleTag(locale);

  const rememberDeliveredNotification = (notificationId: string) => {
    const safeId = String(notificationId || "").trim();
    if (!safeId) {
      return;
    }

    deliveredIdsRef.current.add(safeId);
    writeDeliveredNotificationIds(deliveredIdsRef.current);
  };

  const showSystemNotification = async (item: NotificationItem) => {
    if (!isSystemNotificationSupported()) {
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    if (
      document.visibilityState === "visible" &&
      String(item.href || "").trim() === pathname
    ) {
      rememberDeliveredNotification(item.id);
      return;
    }

    try {
      const registration =
        swRegistrationRef.current || (await navigator.serviceWorker.ready);

      swRegistrationRef.current = registration;

      await registration.showNotification(item.title, {
        body: item.body,
        icon: item.image || "/icon-192-nex-point.png",
        badge: "/icon-192-nex-point.png",
        tag: item.id,
        data: {
          href: item.href || "/",
          id: item.id,
        },
      });

      rememberDeliveredNotification(item.id);
    } catch {
      return;
    }
  };

  const syncPushSubscription = async (
    registrationInput?: ServiceWorkerRegistration | null
  ) => {
    if (!isPushSubscriptionSupported()) {
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    if (pushSubscriptionReadyRef.current) {
      return;
    }

    if (pushSubscriptionSyncRef.current) {
      await pushSubscriptionSyncRef.current;
      return;
    }

    pushSubscriptionSyncRef.current = (async () => {
      const registration =
        registrationInput ||
        swRegistrationRef.current ||
        (await navigator.serviceWorker.ready);
      swRegistrationRef.current = registration;

      const keyRes = await fetch("/api/push/public-key", {
        cache: "no-store",
      });
      const keyData = await keyRes.json().catch(() => ({}));
      const publicKey = String(keyData?.publicKey || "").trim();

      if (!keyRes.ok || !publicKey) {
        return;
      }

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const serialized = serializePushSubscription(subscription);

      if (
        !serialized.endpoint ||
        !serialized.keys?.p256dh ||
        !serialized.keys?.auth
      ) {
        return;
      }

      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscription: serialized,
        }),
        cache: "no-store",
      });

      if (saveRes.ok) {
        pushSubscriptionReadyRef.current = true;
      }
    })()
      .catch(async (error) => {
        if (
          error instanceof DOMException &&
          error.name === "InvalidStateError" &&
          registrationInput?.pushManager
        ) {
          const staleSubscription =
            await registrationInput.pushManager.getSubscription();
          await staleSubscription?.unsubscribe().catch(() => false);
        }
      })
      .finally(() => {
        pushSubscriptionSyncRef.current = null;
      });

    await pushSubscriptionSyncRef.current;
  };

  const requestSystemNotificationPermission = async () => {
    if (!isSystemNotificationSupported()) {
      return;
    }

    if (Notification.permission !== "default") {
      return;
    }

    try {
      const result = await Notification.requestPermission();
      if (result === "granted") {
        await syncPushSubscription();
        void loadNotifications();
      }
    } catch {
      return;
    }
  };

  const loadNotifications = async () => {
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }

    inFlightRef.current = true;
    const requestId = ++requestIdRef.current;
    lastNotificationLoadAtRef.current = getBrowserClockMs();

    try {
      const res = await fetch("/api/notifications", {
        cache: "no-store",
      });

      const data = (await res.json()) as NotificationResponse;
      if (requestId !== requestIdRef.current) {
        return;
      }

      const nextItems = Array.isArray(data?.items) ? data.items : [];
      nextItems.forEach(primeChatNotificationCache);
      const hiddenIds = hiddenIdsRef.current;
      const readRoomAt = readRoomAtRef.current;
      const visibleItems = nextItems.filter(
        (item) =>
          !hiddenIds.has(item.id) &&
          !isChatNotificationReadByRoom(item, readRoomAt)
      );
      setItems(visibleItems);

      if (!hasInitialSyncRef.current) {
        hasInitialSyncRef.current = true;
        for (const item of visibleItems) {
          knownIdsRef.current.add(item.id);
        }
        return;
      }

      deliveredIdsRef.current = readDeliveredNotificationIds();
      const newItems = visibleItems.filter(
        (item) =>
          !knownIdsRef.current.has(item.id) &&
          !deliveredIdsRef.current.has(item.id)
      );

      for (const item of visibleItems) {
        knownIdsRef.current.add(item.id);
      }

      for (const item of newItems) {
        void showSystemNotification(item);
      }
    } catch {
      return;
    } finally {
      inFlightRef.current = false;
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }

      if (queuedRef.current) {
        queuedRef.current = false;
        void loadNotifications();
      }
    }
  };

  const clearNotificationBurstTimers = () => {
    for (const timeoutId of burstTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    burstTimeoutsRef.current = [];
  };

  const queueFastNotificationSync = () => {
    void loadNotifications();
    clearNotificationBurstTimers();
    burstTimeoutsRef.current = [
      window.setTimeout(() => {
        void loadNotifications();
      }, NOTIFICATION_CONFIRM_REFRESH_MS),
    ];
  };

  const shouldRunBackgroundNotificationSync = () =>
    document.visibilityState === "visible" ||
    (isSystemNotificationSupported() && Notification.permission === "granted");

  const markNotificationRead = (notificationId: string) => {
    if (!notificationId) {
      return;
    }

    hiddenIdsRef.current.add(notificationId);
    setItems((prev) => prev.filter((item) => item.id !== notificationId));

    void fetch("/api/notifications/read", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ids: [notificationId],
      }),
      keepalive: true,
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("read failed");
        }
      })
      .catch(() => {
        hiddenIdsRef.current.delete(notificationId);
        void loadNotifications();
      });
  };

  const markNotificationsRead = (notificationIds: string[]) => {
    notificationIds
      .map((id) => String(id || "").trim())
      .filter(Boolean)
      .forEach((id) => markNotificationRead(id));
  };

  const respondToFriendRequest = async (
    notificationId: string,
    requestId: string,
    decision: "accept" | "reject"
  ) => {
    try {
      const res = await fetch("/api/community/friends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "respond",
          requestId,
          decision,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data?.error || "action failed"));
      }

      markNotificationsRead([notificationId]);
      void loadNotifications();
    } catch {
      alert(
        decision === "accept"
          ? "ยอมรับคำขอเพื่อนไม่สำเร็จ"
          : "ปฏิเสธคำขอเพื่อนไม่สำเร็จ"
      );
    }
  };

  useEffect(() => {
    deliveredIdsRef.current = readDeliveredNotificationIds();
  }, []);

  useEffect(() => {
    if (!isSystemNotificationSupported()) {
      return;
    }

    let mounted = true;

    void navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .then((registration) => {
        if (!mounted) {
          return;
        }

        swRegistrationRef.current = registration;
        if (Notification.permission === "granted") {
          void syncPushSubscription(registration);
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isSystemNotificationSupported()) {
      return;
    }

    if (Notification.permission !== "default" || permissionBootstrapBoundRef.current) {
      return;
    }

    permissionBootstrapBoundRef.current = true;

    const requestOnInteraction = () => {
      void requestSystemNotificationPermission();
      window.removeEventListener("pointerdown", requestOnInteraction);
      window.removeEventListener("keydown", requestOnInteraction);
      permissionBootstrapBoundRef.current = false;
    };

    window.addEventListener("pointerdown", requestOnInteraction, {
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", requestOnInteraction, {
      once: true,
    });

    return () => {
      window.removeEventListener("pointerdown", requestOnInteraction);
      window.removeEventListener("keydown", requestOnInteraction);
      permissionBootstrapBoundRef.current = false;
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      queueFastNotificationSync();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const fallbackMs = realtimeConnectedRef.current
        ? NOTIFICATION_REALTIME_FALLBACK_MS
        : NOTIFICATION_CONNECTING_FALLBACK_MS;

      if (
        shouldRunBackgroundNotificationSync() &&
        getBrowserClockMs() - lastNotificationLoadAtRef.current >= fallbackMs
      ) {
        void loadNotifications();
      }
    }, NOTIFICATION_POLL_TICK_MS);

    const onFocus = () => {
      queueFastNotificationSync();
    };

    const onVisibility = () => {
      if (shouldRunBackgroundNotificationSync()) {
        queueFastNotificationSync();
      }
    };

    const onChatRead = (event: Event) => {
      const detail = (event as CustomEvent<{
        roomId?: string | null;
        roomIds?: Array<string | null | undefined> | null;
        unreadCount?: number | null;
        readAt?: string | null;
      }>).detail;
      const roomIds = new Set(
        [detail?.roomId, ...(detail?.roomIds || [])]
          .map((roomId) => String(roomId || "").trim())
          .filter(Boolean)
      );
      const readAt = String(detail?.readAt || new Date().toISOString()).trim();
      const now = Date.now();
      const shouldCountRead =
        roomIds.size > 0 &&
        !Array.from(roomIds).some((roomId) => {
          const lastReadAt = recentReadRoomAtRef.current.get(roomId) || 0;
          return lastReadAt > 0 && now - lastReadAt < 3500;
        });

      if (roomIds.size > 0) {
        if (shouldCountRead) {
          for (const roomId of roomIds) {
            recentReadRoomAtRef.current.set(roomId, now);
          }

          if (recentReadRoomAtRef.current.size > 480) {
            for (const [roomId, lastReadAt] of recentReadRoomAtRef.current) {
              if (now - lastReadAt > 10000) {
                recentReadRoomAtRef.current.delete(roomId);
              }
            }
          }
        }

        for (const roomId of roomIds) {
          const currentTime = safeTime(readRoomAtRef.current.get(roomId));
          const nextTime = safeTime(readAt);
          if (!currentTime || nextTime >= currentTime) {
            readRoomAtRef.current.set(roomId, readAt);
          }
        }

        setItems((currentItems) => {
          const nextItems: NotificationItem[] = [];

          for (const item of currentItems) {
            if (isChatNotificationForRooms(item, roomIds)) {
              hiddenIdsRef.current.add(item.id);
              continue;
            }

            nextItems.push(item);
          }

          return nextItems;
        });
      }

      const unreadCount = Math.max(1, Number(detail?.unreadCount || 1));
      if (shouldCountRead) {
        setFastChatUnreadCount((current) => {
          const nextCount = Math.max(0, current - unreadCount);
          fastChatUnreadCountRef.current = nextCount;
          return nextCount;
        });
      }
      queueFastNotificationSync();
    };

    const onChatUnreadCount = (event: Event) => {
      const nextCount = Math.max(
        0,
        Number(
          (event as CustomEvent<{ count?: number | null }>).detail?.count || 0
        )
      );
      const previousCount = fastChatUnreadCountRef.current;

      fastChatUnreadCountRef.current = nextCount;
      setFastChatUnreadCount(nextCount);

      if (nextCount > previousCount) {
        queueFastNotificationSync();
      }
    };

    const onChatMessageReceived = (event: Event) => {
      const source = String(
        (event as CustomEvent<{ source?: string | null }>).detail?.source || ""
      );
      if (source === "notification-cache") {
        return;
      }

      queueFastNotificationSync();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("nexora:chat-read", onChatRead);
    window.addEventListener("nexora:chat-message-received", onChatMessageReceived);
    window.addEventListener("nexora:chat-unread-count", onChatUnreadCount);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(intervalId);
      clearNotificationBurstTimers();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("nexora:chat-read", onChatRead);
      window.removeEventListener("nexora:chat-message-received", onChatMessageReceived);
      window.removeEventListener("nexora:chat-unread-count", onChatUnreadCount);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      return;
    }

    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`notification-bell-${Date.now()}`);

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dmMessage" },
      () => {
        queueFastNotificationSync();
      }
    );

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dm_room" },
      () => {
        queueFastNotificationSync();
      }
    );

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "AppNotification" },
      () => {
        queueFastNotificationSync();
      }
    );

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "FriendRequest" },
      () => {
        queueFastNotificationSync();
      }
    );

    channel.subscribe((status) => {
      realtimeConnectedRef.current = status === "SUBSCRIBED";
      if (status === "SUBSCRIBED") {
        queueFastNotificationSync();
      }
    });
    channelRef.current = channel;

    return () => {
      realtimeConnectedRef.current = false;
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

  const unreadItems = useMemo(() => items, [items]);
  const totalUnreadCount = useMemo(() => {
    const chatItemCount = unreadItems.filter((item) => item.type === "chat").length;
    const nonChatItemCount = unreadItems.length - chatItemCount;

    return nonChatItemCount + Math.max(chatItemCount, fastChatUnreadCount);
  }, [fastChatUnreadCount, unreadItems]);

  return (
    <div className="relative z-[700]" ref={wrapRef}>
      <button
        type="button"
        onClick={async (e) => {
          e.stopPropagation();
          if (isSystemNotificationSupported() && Notification.permission === "default") {
            await requestSystemNotificationPermission();
          }
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
                const isFriendRequest =
                  item.type === "friend" &&
                  String(item.meta?.action || "") === "request" &&
                  String(item.meta?.requestId || "").trim();
                const requestId = String(item.meta?.requestId || "").trim();

                return (
                  <div
                    key={item.id}
                    className="group rounded-[22px] border border-transparent px-3 py-3 transition hover:border-amber-300/10 hover:bg-white/[0.03]"
                  >
                    <div className="flex items-start gap-3">
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

                        {isFriendRequest && requestId ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void respondToFriendRequest(
                                  item.id,
                                  requestId,
                                  "accept"
                                )
                              }
                              className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-[14px] border border-amber-300/22 bg-[linear-gradient(180deg,rgba(251,191,36,0.18),rgba(251,191,36,0.08))] px-3 text-xs font-black text-amber-100 transition hover:brightness-110"
                            >
                              ยอมรับ
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void respondToFriendRequest(
                                  item.id,
                                  requestId,
                                  "reject"
                                )
                              }
                              className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-[14px] border border-red-300/18 bg-red-500/10 px-3 text-xs font-black text-red-200 transition hover:bg-red-500/16"
                            >
                              ปฏิเสธ
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <Link
                              href={item.href}
                              onClick={() => {
                                const roomId = getChatNotificationRoomId(item);
                                if (roomId) {
                                  const roomIds = new Set([roomId]);
                                  const relatedChatItems = items.filter((candidate) =>
                                    isChatNotificationForRooms(candidate, roomIds)
                                  );
                                  const readAt = new Date().toISOString();
                                  dispatchClientChatRead({
                                    roomId,
                                    roomIds: [roomId],
                                    unreadCount: Math.max(1, relatedChatItems.length),
                                    readAt,
                                  });
                                  markNotificationsRead(
                                    relatedChatItems.length > 0
                                      ? relatedChatItems.map((candidate) => candidate.id)
                                      : [item.id]
                                  );
                                } else {
                                  markNotificationRead(item.id);
                                }
                                setOpen(false);
                              }}
                              className="inline-flex min-h-[38px] items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.03] px-3 text-xs font-bold text-white/78 transition hover:bg-white/[0.06]"
                            >
                              เปิดดู
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_14px_rgba(248,113,113,0.75)]" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
