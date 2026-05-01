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

      Object.entries(state).forEach(([key, metas]) => {
        const normalizedKey = normalizePresenceId(key);
        if (normalizedKey) {
          nextIds.add(normalizedKey);
        }

        (Array.isArray(metas) ? metas : []).forEach((meta) => {
          const record = meta as Record<string, unknown>;
          [
            record.userId,
            record.id,
            record.lineId,
          ].forEach((value) => {
            const normalized = normalizePresenceId(
              typeof value === "string" ? value : ""
            );
            if (normalized) {
              nextIds.add(normalized);
            }
          });
        });
      });

      setOnlineIds(nextIds);
    };

    const trackOnline = async () => {
      if (closed) {
        return;
      }

      await channel.track({
        userId,
        lineId,
        name: userName,
        image: userImage,
        tabId: tabIdRef.current,
        onlineAt: new Date().toISOString(),
      });
    };

    channel
      .on("presence", { event: "sync" }, readPresenceState)
      .on("presence", { event: "join" }, readPresenceState)
      .on("presence", { event: "leave" }, readPresenceState)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void trackOnline();
          readPresenceState();
        }
      });

    trackTimer = setInterval(() => {
      void trackOnline();
    }, 25000);

    const handleFocus = () => {
      void trackOnline();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void trackOnline();
      }
    };
    const handlePageHide = () => {
      void channel.untrack();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      closed = true;
      if (trackTimer) {
        clearInterval(trackTimer);
      }
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibility);
      void channel.untrack();
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
