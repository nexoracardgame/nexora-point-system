"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";

type TypingUser = {
  id?: string | null;
  name?: string | null;
  image?: string | null;
};

type TypingPayload = {
  roomId?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  senderImage?: string | null;
  isTyping?: boolean | null;
  at?: string | null;
};

const TYPING_HEARTBEAT_MS = 4000;
const TYPING_STALE_MS = 9500;

function safeText(value?: string | number | null) {
  return String(value || "").trim();
}

function getTypingChannelName(roomId: string) {
  return `nexora-chat-typing-${roomId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function clearTimer(ref: MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (ref.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
}

export function useChatTyping({
  roomId,
  me,
  other,
  isTyping,
  enabled = true,
}: {
  roomId?: string | null;
  me?: TypingUser | null;
  other?: TypingUser | null;
  isTyping: boolean;
  enabled?: boolean;
}) {
  const [otherTyping, setOtherTyping] = useState(false);
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getBrowserSupabaseClient>>["channel"]> | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTypingRef = useRef(false);

  const safeRoomId = safeText(roomId);
  const meId = safeText(me?.id);
  const otherId = safeText(other?.id);
  const shouldPublishTyping = Boolean(enabled && safeRoomId && meId && isTyping);

  const basePayload = useMemo(
    () => ({
      roomId: safeRoomId,
      senderId: meId,
      senderName: safeText(me?.name) || "NEXORA User",
      senderImage: safeText(me?.image) || "/avatar.png",
    }),
    [me?.image, me?.name, meId, safeRoomId]
  );

  const publishTyping = useCallback(
    (nextTyping: boolean) => {
      const channel = channelRef.current;
      if (!channel || !basePayload.roomId || !basePayload.senderId) {
        return;
      }

      void channel
        .send({
          type: "broadcast",
          event: "typing",
          payload: {
            ...basePayload,
            isTyping: nextTyping,
            at: new Date().toISOString(),
          } satisfies TypingPayload,
        })
        .catch(() => undefined);
    },
    [basePayload]
  );

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();

    if (!supabase || !safeRoomId || !meId) {
      setOtherTyping(false);
      return;
    }

    const channel = supabase.channel(getTypingChannelName(safeRoomId), {
      config: {
        broadcast: {
          self: false,
        },
      },
    });

    channelRef.current = channel;
    setOtherTyping(false);
    clearTimer(staleTimerRef);

    channel.on("broadcast", { event: "typing" }, ({ payload }) => {
      const data = (payload || {}) as TypingPayload;
      const senderId = safeText(data.senderId);

      if (
        safeText(data.roomId) !== safeRoomId ||
        !senderId ||
        senderId === meId ||
        (otherId && senderId !== otherId)
      ) {
        return;
      }

      clearTimer(staleTimerRef);

      if (data.isTyping) {
        setOtherTyping(true);
        staleTimerRef.current = setTimeout(() => {
          setOtherTyping(false);
          staleTimerRef.current = null;
        }, TYPING_STALE_MS);
        return;
      }

      setOtherTyping(false);
    });

    channel.subscribe();

    return () => {
      const cleanupPayload = {
        roomId: safeRoomId,
        senderId: meId,
        senderName: safeText(me?.name) || "NEXORA User",
        senderImage: safeText(me?.image) || "/avatar.png",
        isTyping: false,
        at: new Date().toISOString(),
      } satisfies TypingPayload;

      void channel
        .send({
          type: "broadcast",
          event: "typing",
          payload: cleanupPayload,
        })
        .catch(() => undefined);
      clearTimer(staleTimerRef);
      setOtherTyping(false);
      localTypingRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [me?.image, me?.name, meId, otherId, safeRoomId]);

  useEffect(() => {
    if (localTypingRef.current === shouldPublishTyping) {
      return;
    }

    localTypingRef.current = shouldPublishTyping;
    publishTyping(shouldPublishTyping);
  }, [publishTyping, shouldPublishTyping]);

  useEffect(() => {
    if (!shouldPublishTyping) {
      return;
    }

    const intervalId = setInterval(() => {
      publishTyping(true);
    }, TYPING_HEARTBEAT_MS);

    return () => clearInterval(intervalId);
  }, [publishTyping, shouldPublishTyping]);

  return otherTyping;
}
