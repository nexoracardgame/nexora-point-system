import { getDealChatRoomId } from "@/lib/deal-chat";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export async function cleanupDealChat(dealId: string) {
  const roomId = getDealChatRoomId(dealId);
  const supabase = getServerSupabaseClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("dmMessage").delete().eq("roomId", roomId);

  if (error) {
    console.error("DEAL CHAT CLEANUP ERROR:", error);
  }
}
