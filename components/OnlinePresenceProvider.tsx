"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";

type OnlinePresenceContextValue = {
  onlineIds: Set<string>;
  isOnline: (...ids: Array<string | null | undefined>) => boolean;
};

const PRESENCE_HEARTBEAT_MS = 1200;
const PRESENCE_SYNC_MS = 1200;
const PRESENCE_FAST_RETRY_MS = 350;

const OnlinePresenceContext = createContext<OnlinePresenceContextValue>({
  onlineIds: new Set(),
  isOnline: () => false,
});

function normalizePresenceId(value?: string | null) {
  return String(value || "").trim();
}

function createTabId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function arePresenceSetsEqual(first: Set<string>, second: Set<string>) {
  if (first.size !== second.size) return false;

  for (const value of first) {
    if (!second.has(value)) return false;
  }

  return true;
}

function parseOnlineIds(payload: unknown) {
  const source = payload as { onlineIds?: unknown };
  if (!Array.isArray(source?.onlineIds)) {
    return null;
  }

  return new Set(
    source.onlineIds
      .map((id) => normalizePresenceId(typeof id === "string" ? id : ""))
      .filter(Boolean)
  );
}

export function OnlinePresenceProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const sessionUser = (session?.user || {}) as {
    id?: string | null;
    lineId?: string | null;
  };
  const userId = normalizePresenceId(sessionUser.id);
  const lineId = normalizePresenceId(sessionUser.lineId);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const tabIdRef = useRef("");
  const syncInFlightRef = useRef(false);
  const heartbeatInFlightRef = useRef(false);
  const lastHeartbeatAtRef = useRef(0);

  useEffect(() => {
    if (!tabIdRef.current) {
      tabIdRef.current = createTabId();
    }
  }, []);

  const applyOnlineIds = useCallback((nextIds: Set<string> | null) => {
    if (!nextIds) return;

    setOnlineIds((prev) =>
      arePresenceSetsEqual(prev, nextIds) ? prev : nextIds
    );
  }, []);

  const syncPresence = useCallback(async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;

    try {
      const res = await fetch(`/api/presence?ts=${Date.now()}`, {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => null);
      if (res.ok) {
        applyOnlineIds(parseOnlineIds(payload));
      }
    } catch {
      return;
    } finally {
      syncInFlightRef.current = false;
    }
  }, [applyOnlineIds]);

  const heartbeat = useCallback(
    async (force = false) => {
      if (!userId || heartbeatInFlightRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      const now = Date.now();
      if (!force && now - lastHeartbeatAtRef.current < PRESENCE_FAST_RETRY_MS) {
        return;
      }

      heartbeatInFlightRef.current = true;
      lastHeartbeatAtRef.current = now;

      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            action: "online",
            tabId: tabIdRef.current,
            lineId,
          }),
        });
        const payload = await res.json().catch(() => null);
        if (res.ok) {
          applyOnlineIds(parseOnlineIds(payload));
        }
      } catch {
        void syncPresence();
      } finally {
        heartbeatInFlightRef.current = false;
      }
    },
    [applyOnlineIds, lineId, syncPresence, userId]
  );

  const sendOffline = useCallback(() => {
    if (!userId || !tabIdRef.current) return;

    const payload = JSON.stringify({
      action: "offline",
      tabId: tabIdRef.current,
      lineId,
    });

    try {
      if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        const blob = new Blob([payload], { type: "application/json" });
        if (navigator.sendBeacon("/api/presence", blob)) {
          return;
        }
      }
    } catch {
      // Keepalive fetch below is the fallback.
    }

    void fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      keepalive: true,
      body: payload,
    }).catch(() => undefined);
  }, [lineId, userId]);

  useEffect(() => {
    if (!userId) {
      setOnlineIds(new Set());
      return;
    }

    let closed = false;
    const pulse = () => {
      if (closed) return;
      void heartbeat(true);
    };
    const sync = () => {
      if (closed) return;
      void syncPresence();
    };
    const wake = () => {
      if (document.visibilityState === "visible") {
        pulse();
        window.setTimeout(sync, 120);
        window.setTimeout(pulse, 320);
        return;
      }
    };
    const pageOut = () => {
      sendOffline();
    };

    pulse();
    sync();
    window.setTimeout(pulse, 220);
    window.setTimeout(sync, 500);

    const heartbeatTimer = window.setInterval(pulse, PRESENCE_HEARTBEAT_MS);
    const syncTimer = window.setInterval(sync, PRESENCE_SYNC_MS);

    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", wake);
    window.addEventListener("beforeunload", pageOut);
    window.addEventListener("pagehide", pageOut);
    document.addEventListener("visibilitychange", wake);

    return () => {
      closed = true;
      sendOffline();
      window.clearInterval(heartbeatTimer);
      window.clearInterval(syncTimer);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("beforeunload", pageOut);
      window.removeEventListener("pagehide", pageOut);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [heartbeat, sendOffline, syncPresence, userId]);

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
