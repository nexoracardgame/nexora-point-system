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

const PRESENCE_HEARTBEAT_MS = 5000;
const PRESENCE_STALE_MS = 12000;
const PRESENCE_PRUNE_MS = 2000;

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
  const offlineTabsRef = useRef<Set<string>>(new Set());

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

    const readPresenceState = () => {
      const state = channel.presenceState();
      const nextIds = new Set<string>();
      const now = Date.now();

      Object.entries(state).forEach(([key, metas]) => {
        (Array.isArray(metas) ? metas : []).forEach((meta) => {
          const record = meta as Record<string, unknown>;
          const tabId = normalizeUnknownPresenceValue(record.tabId);
          const onlineAt = normalizeUnknownPresenceValue(record.onlineAt);
          const onlineAtMs = onlineAt ? Date.parse(onlineAt) : 0;
          const isFresh =
            !onlineAtMs || !Number.isFinite(onlineAtMs)
              ? true
              : now - onlineAtMs <= PRESENCE_STALE_MS;

          if (!isFresh) {
            return;
          }

          const ids = Array.from(
            new Set(
              [key, record.userId, record.id, record.lineId]
                .map(normalizeUnknownPresenceValue)
                .filter(Boolean)
            )
          );
          const isTabOffline =
            tabId &&
            ids.some((id) =>
              offlineTabsRef.current.has(buildOfflineTabKey(id, tabId))
            );

          if (isTabOffline) {
            return;
          }

          ids.forEach((id) => nextIds.add(id));
        });
      });

      setOnlineIds(nextIds);
    };

    const markTabOffline = (payload?: Record<string, unknown> | null) => {
      const tabId = normalizeUnknownPresenceValue(payload?.tabId);
      if (!tabId) {
        return;
      }

      [
        payload?.userId,
        payload?.id,
        payload?.lineId,
      ].forEach((value) => {
        const id = normalizeUnknownPresenceValue(value);
        if (id) {
          offlineTabsRef.current.add(buildOfflineTabKey(id, tabId));
        }
      });

      readPresenceState();
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

      await channel.track({
        userId,
        lineId,
        name: userName,
        image: userImage,
        tabId: tabIdRef.current,
        onlineAt: new Date().toISOString(),
      });
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
      void channel.send({
        type: "broadcast",
        event: "presence-offline",
        payload,
      });
      void channel.untrack();
    };

    channel
      .on("presence", { event: "sync" }, readPresenceState)
      .on("presence", { event: "join" }, readPresenceState)
      .on("presence", { event: "leave" }, readPresenceState)
      .on("broadcast", { event: "presence-offline" }, (event) => {
        markTabOffline((event as { payload?: Record<string, unknown> })?.payload || null);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void trackOnline();
          readPresenceState();
        }
      });

    trackTimer = setInterval(() => {
      void trackOnline();
    }, PRESENCE_HEARTBEAT_MS);
    pruneTimer = setInterval(readPresenceState, PRESENCE_PRUNE_MS);

    const handleFocus = () => {
      void trackOnline();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void trackOnline();
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
