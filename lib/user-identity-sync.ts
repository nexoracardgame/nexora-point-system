import { createClient } from "@supabase/supabase-js";
import { syncLocalDealIdentity } from "@/lib/local-deal-store";
import { syncLocalMarketIdentity } from "@/lib/local-market-store";
import { sanitizeUserImage, sanitizeUserName } from "@/lib/user-identity";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function syncUserIdentityEverywhere(input: {
  userId: string;
  name?: string | null;
  image?: string | null;
}) {
  const userId = String(input.userId || "").trim();

  if (!userId) {
    return;
  }

  const name = sanitizeUserName(input.name);
  const image = sanitizeUserImage(input.image);

  await Promise.allSettled([
    syncLocalMarketIdentity(userId, name, image),
    syncLocalDealIdentity(userId, name, image),
    supabase
      .from("dm_room")
      .update({
        useraname: name,
        useraimage: image,
      })
      .eq("usera", userId),
    supabase
      .from("dm_room")
      .update({
        userbname: name,
        userbimage: image,
      })
      .eq("userb", userId),
    supabase
      .from("dmMessage")
      .update({
        senderName: name,
        senderImage: image,
      })
      .eq("senderId", userId),
  ]);
}
