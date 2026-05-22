"use client";

import {
  CHAT_MESSAGE_BROADCAST_EVENT,
  getChatRoomBroadcastTopic,
  type ChatRealtimeBroadcastPayload,
} from "@/lib/chat-realtime-broadcast";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";

export type ChatBroadcastChannel = {
  send: (
    args: {
      type: "broadcast";
      event: string;
      payload: ChatRealtimeBroadcastPayload;
    },
    opts?: { timeout?: number }
  ) => Promise<unknown>;
};

const CLIENT_OPTIMISTIC_BROADCAST_TIMEOUT_MS = 350;
const CLIENT_OPTIMISTIC_HTTP_FALLBACK_MS = 120;

export function broadcastOptimisticChatMessage(
  payload: ChatRealtimeBroadcastPayload,
  channel?: ChatBroadcastChannel | null,
  topicRoomId?: string | null
) {
  const broadcastRoomId = String(topicRoomId || payload.roomId || "").trim();
  const payloadRoomId = String(payload.roomId || broadcastRoomId).trim();
  const topic = getChatRoomBroadcastTopic(broadcastRoomId);

  if (!topic) {
    return;
  }

  const nextPayload: ChatRealtimeBroadcastPayload = {
    ...payload,
    roomId: payloadRoomId,
    optimistic: true,
    source: payload.source || "client-optimistic",
  };

  let httpFallbackStarted = false;
  const sendHttpFallback = () => {
    if (httpFallbackStarted) {
      return;
    }

    httpFallbackStarted = true;
    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      return;
    }

    const broadcastChannel = supabase.channel(topic);
    void broadcastChannel
      .httpSend(CHAT_MESSAGE_BROADCAST_EVENT, nextPayload, {
        timeout: CLIENT_OPTIMISTIC_BROADCAST_TIMEOUT_MS,
      })
      .catch((error) => {
        console.warn("Client chat HTTP broadcast failed:", error);
      })
      .finally(() => {
        void supabase.removeChannel(broadcastChannel);
      });
  };

  if (!channel) {
    sendHttpFallback();
    return;
  }

  const fallbackTimer =
    typeof window !== "undefined"
      ? window.setTimeout(sendHttpFallback, CLIENT_OPTIMISTIC_HTTP_FALLBACK_MS)
      : null;

  void channel
    .send(
      {
        type: "broadcast",
        event: CHAT_MESSAGE_BROADCAST_EVENT,
        payload: nextPayload,
      },
      { timeout: CLIENT_OPTIMISTIC_BROADCAST_TIMEOUT_MS }
    )
    .then((response) => {
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
      }
      if (response !== "ok") {
        sendHttpFallback();
      }
    })
    .catch((error) => {
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
      }
      console.warn("Client chat websocket broadcast failed:", error);
      sendHttpFallback();
    });
}
