import { createClient } from "@supabase/supabase-js";
import { getDealChatRoomId } from "@/lib/deal-chat";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function cleanupDealChat(dealId: string) {
  const roomId = getDealChatRoomId(dealId);

  const { error } = await supabase.from("dmMessage").delete().eq("roomId", roomId);

  if (error) {
    console.error("DEAL CHAT CLEANUP ERROR:", error);
  }
}
