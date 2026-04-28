import { type SupabaseClient } from "@supabase/supabase-js";
import {
  CHAT_HISTORY_PAGE_SIZE,
  type ChatHistoryPage,
  type ChatMessage,
} from "@/lib/chat-room-types";
import { getServerSupabaseClient } from "@/lib/supabase-server";

type DmMessageRow = Omit<ChatMessage, "sender" | "optimistic">;

export async function getChatMessagesPage(input: {
  roomId: string;
  limit?: number;
  before?: string | null;
  after?: string | null;
  supabase?: SupabaseClient | null;
}): Promise<ChatHistoryPage> {
  const roomId = String(input.roomId || "").trim();
  const limit = Math.max(1, Math.min(200, Number(input.limit || CHAT_HISTORY_PAGE_SIZE)));
  const before = String(input.before || "").trim() || null;
  const after = String(input.after || "").trim() || null;
  const supabase = input.supabase ?? getServerSupabaseClient();

  if (!roomId || !supabase) {
    return {
      messages: [],
      hasMore: false,
      nextCursor: null,
    };
  }

  let query = supabase
    .from("dmMessage")
    .select("*")
    .eq("roomId", roomId)
    .order("createdAt", { ascending: false })
    .limit(limit + 1);

  if (before) {
    query = query.lt("createdAt", before);
  }

  if (after) {
    query = query.gt("createdAt", after);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? (data as DmMessageRow[]) : [];
  const hasMore = rows.length > limit;
  const trimmed = rows.slice(0, limit).reverse();
  const nextCursor = hasMore
    ? String(trimmed[0]?.createdAt || "").trim() || null
    : null;

  return {
    messages: trimmed.map((message) => ({
      ...message,
      roomId,
    })),
    hasMore,
    nextCursor,
  };
}
