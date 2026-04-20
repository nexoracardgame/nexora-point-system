import { getDealChatRoomId } from "@/lib/deal-chat";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export async function cleanupDealChat(dealId: string) {
  const roomId = getDealChatRoomId(dealId);
  const supabase = getServerSupabaseClient();

  if (!supabase) {
    return;
  }

  const [messageResult, roomResult] = await Promise.allSettled([
    supabase.from("dmMessage").delete().eq("roomId", roomId),
    supabase.from("dm_room").delete().eq("roomid", roomId),
  ]);

  if (
    messageResult.status === "fulfilled" &&
    messageResult.value.error
  ) {
    console.error("DEAL CHAT MESSAGE CLEANUP ERROR:", messageResult.value.error);
  }

  if (
    roomResult.status === "fulfilled" &&
    roomResult.value.error
  ) {
    console.error("DEAL CHAT ROOM CLEANUP ERROR:", roomResult.value.error);
  }

  if (messageResult.status === "rejected") {
    console.error("DEAL CHAT MESSAGE CLEANUP ERROR:", messageResult.reason);
  }

  if (roomResult.status === "rejected") {
    console.error("DEAL CHAT ROOM CLEANUP ERROR:", roomResult.reason);
  }
}
