"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";

type OnlinePresenceContextValue = {
  onlineIds: Set<string>;
  isOnline: (...ids: Array<string | null | undefined>) => boolean;
};

type LivePresenceTab = {
  ids: string[];
  tabId: string;
  lastSeenMs: number;
  onlineAtMs: number;
};

const PRESENCE_HEARTBEAT_MS = 1500;
const PRESENCE_STALE_MS = 5500;
const PRESENCE_PRUNE_MS = 900;

const OnlinePresenceContext = createContext<OnlinePresenceContextValue>({
  onlineIds: new Set(),
  isOnline: () => false,
});

function normalizePresenceId(value?: string | null) {
  return String(value || "").trim();
}

function normalizeUnknownPresenceValue(value: unknown) {
  return normalizePresenceId(typeof value === "string" ? value : "");
}

function buildOfflineTabKey(id: string, tabId: string) {
  return `${id}::${tabId}`;
}

function buildLiveTabKey(primaryId: string, tabId: string) {
  return `${primaryId}::${tabId}`;
}

function parsePresenceTime(value: unknown) {
  const parsed = Date.parse(typeof value === "string" ? value : "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function getUniquePresenceIds(
  values: Array<unknown>,
  fallbackKey?: string | null
) {
  return Array.from(
    new Set(
      [fallbackKey, ...values]
        .map((value) => normalizeUnknownPresenceValue(value))
        .filter(Boolean)
    )
  );
}

function arePresenceSetsEqual(first: Set<string>, second: Set<string>) {
  if (first.size !== second.size) {
    return false;
  }

  for (const value of first) {
    if (!second.has(value)) {
      return false;
    }
  }

  return true;
}

function createTabId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function OnlinePresenceProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const sessionUser = (session?.user || {}) as {
    id?: string | null;
    lineId?: string | null;
    name?: string | null;
    image?: string | null;
  };
  const userId = normalizePresenceId(sessionUser.id);
  const userName = normalizePresenceId(sessionUser.name);
  const userImage = normalizePresenceId(sessionUser.image);
  const lineId = normalizePresenceId(sessionUser.lineId);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const tabIdRef = useRef("");
  const liveTabsRef = useRef<Map<string, LivePresenceTab>>(new Map());
  const offlineTabsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!tabIdRef.current) {
      tabIdRef.current = createTabId();
    }
  }, []);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();

    if (!supabase || !userId) {
      setOnlineIds(new Set());
      return;
    }

    let closed = false;
    let trackTimer: ReturnType<typeof setInterval> | null = null;
    let pruneTimer: ReturnType<typeof setInterval> | null = null;
    const channel = supabase.channel("nexora-online-presence", {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    const publishOnlineIds = () => {
      const nextIds = new Set<string>();
      const now = Date.now();

      liveTabsRef.current.forEach((tab, key) => {
        const isFresh = now - tab.lastSeenMs <= PRESENCE_STALE_MS;
        if (!isFresh) {
          liveTabsRef.current.delete(key);
          return;
        }

        const hasNewerOffline = tab.ids.some((id) => {
          const offlineAtMs = offlineTabsRef.current.get(
            buildOfflineTabKey(id, tab.tabId)
          );
          return !!offlineAtMs && offlineAtMs > tab.onlineAtMs;
        });

        if (hasNewerOffline) {
          liveTabsRef.current.delete(key);
          return;
        }

        tab.ids.forEach((id) => nextIds.add(id));
      });

      setOnlineIds((prev) =>
        arePresenceSetsEqual(prev, nextIds) ? prev : nextIds
      );
    };

    const markTabOnline = (
      payload?: Record<string, unknown> | null,
      fallbackKey?: string | null
    ) => {
      if (!payload) {
        return;
      }

      const tabId = normalizeUnknownPresenceValue(payload.tabId);
      const ids = getUniquePresenceIds(
        [payload.userId, payload.id, payload.lineId],
        fallbackKey
      );

      if (!tabId || ids.length === 0) {
        return;
      }

      const onlineAtMs = parsePresenceTime(payload.onlineAt) || Date.now();

      ids.forEach((id) => {
        const offlineKey = buildOfflineTabKey(id, tabId);
        const offlineAtMs = offlineTabsRef.current.get(offlineKey);

        if (!offlineAtMs || onlineAtMs >= offlineAtMs) {
          offlineTabsRef.current.delete(offlineKey);
        }
      });

      const isStillOffline = ids.some((id) => {
        const offlineAtMs = offlineTabsRef.current.get(
          buildOfflineTabKey(id, tabId)
        );
        return !!offlineAtMs && offlineAtMs > onlineAtMs;
      });

      if (isStillOffline) {
        return;
      }

      liveTabsRef.current.set(buildLiveTabKey(ids[0], tabId), {
        ids,
        tabId,
        lastSeenMs: Date.now(),
        onlineAtMs,
      });
    };

    const readPresenceState = () => {
      const state = channel.presenceState();

      Object.entries(state).forEach(([key, metas]) => {
        (Array.isArray(metas) ? metas : []).forEach((meta) => {
          markTabOnline(meta as Record<string, unknown>, key);
        });
      });

      publishOnlineIds();
    };

    const requestPresenceSnapshot = () => {
      void channel
        .send({
          type: "broadcast",
          event: "presence-request",
          payload: {
            requesterId: userId,
            requesterTabId: tabIdRef.current,
            requestedAt: new Date().toISOString(),
          },
        })
        .catch(() => undefined);
    };

    const markTabOffline = (payload?: Record<string, unknown> | null) => {
      const tabId = normalizeUnknownPresenceValue(payload?.tabId);
      if (!tabId) {
        return;
      }

      const offlineAtMs = parsePresenceTime(payload?.offlineAt) || Date.now();
      const ids = getUniquePresenceIds([
        payload?.userId,
        payload?.id,
        payload?.lineId,
      ]);

      ids.forEach((id) => {
        offlineTabsRef.current.set(buildOfflineTabKey(id, tabId), offlineAtMs);
      });

      liveTabsRef.current.forEach((tab, key) => {
        if (
          tab.tabId === tabId &&
          tab.ids.some((id) => ids.length === 0 || ids.includes(id))
        ) {
          liveTabsRef.current.delete(key);
        }
      });

      publishOnlineIds();
    };

    const trackOnline = async () => {
      if (closed) {
        return;
      }

      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      [userId, lineId].filter(Boolean).forEach((id) => {
        offlineTabsRef.current.delete(buildOfflineTabKey(id, tabIdRef.current));
      });

      const payload = {
        userId,
        lineId,
        name: userName,
        image: userImage,
        tabId: tabIdRef.current,
        onlineAt: new Date().toISOString(),
      };

      markTabOnline(payload, userId);
      publishOnlineIds();

      void channel
        .send({
          type: "broadcast",
          event: "presence-online",
          payload,
        })
        .catch(() => undefined);

      try {
        await channel.track(payload);
        void channel
          .send({
            type: "broadcast",
            event: "presence-online",
            payload,
          })
          .catch(() => undefined);
      } catch {
        // Presence is best-effort; the next heartbeat/resubscribe will repair it.
      }
    };

    const announceOffline = () => {
      if (closed) {
        return;
      }

      const payload = {
        userId,
        lineId,
        tabId: tabIdRef.current,
        offlineAt: new Date().toISOString(),
      };

      markTabOffline(payload);
      void channel
        .send({
          type: "broadcast",
          event: "presence-offline",
          payload,
        })
        .catch(() => undefined);
      void channel.untrack();
    };

    channel
      .on("presence", { event: "sync" }, readPresenceState)
      .on("presence", { event: "join" }, readPresenceState)
      .on("presence", { event: "leave" }, readPresenceState)
      .on("broadcast", { event: "presence-online" }, (event) => {
        markTabOnline(
          (event as { payload?: Record<string, unknown> })?.payload || null
        );
        publishOnlineIds();
      })
      .on("broadcast", { event: "presence-request" }, () => {
        if (document.visibilityState === "visible") {
          void trackOnline();
        }
      })
      .on("broadcast", { event: "presence-offline" }, (event) => {
        markTabOffline((event as { payload?: Record<string, unknown> })?.payload || null);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void trackOnline();
          requestPresenceSnapshot();
          readPresenceState();
        }
      });

    trackTimer = setInterval(() => {
      void trackOnline();
    }, PRESENCE_HEARTBEAT_MS);
    pruneTimer = setInterval(() => {
      readPresenceState();
      publishOnlineIds();
    }, PRESENCE_PRUNE_MS);

    const handleFocus = () => {
      void trackOnline();
      requestPresenceSnapshot();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void trackOnline();
        requestPresenceSnapshot();
        return;
      }

      announceOffline();
    };
    const handlePageHide = () => {
      announceOffline();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("beforeunload", handlePageHide);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("freeze", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      announceOffline();
      closed = true;
      if (trackTimer) {
        clearInterval(trackTimer);
      }
      if (pruneTimer) {
        clearInterval(pruneTimer);
      }
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("beforeunload", handlePageHide);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("freeze", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibility);
      void supabase.removeChannel(channel);
    };
  }, [lineId, userId, userImage, userName]);

  const value = useMemo<OnlinePresenceContextValue>(
    () => ({
      onlineIds,
      isOnline: (...ids) =>
        ids
          .map((id) => normalizePresenceId(id))
          .filter(Boolean)
          .some((id) => onlineIds.has(id)),
    }),
    [onlineIds]
  );

  return (
    <OnlinePresenceContext.Provider value={value}>
      {children}
    </OnlinePresenceContext.Provider>
  );
}

export function useOnlinePresence() {
  return useContext(OnlinePresenceContext);
}
