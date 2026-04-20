import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { syncLocalDealIdentity } from "@/lib/local-deal-store";
import { syncLocalMarketIdentity } from "@/lib/local-market-store";
import { prisma } from "@/lib/prisma";
import { sanitizeUserImage, sanitizeUserName } from "@/lib/user-identity";

let supabaseClient: SupabaseClient | null | undefined;

function getSupabaseClient() {
  if (supabaseClient !== undefined) {
    return supabaseClient;
  }

  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ""
  ).trim();

  if (!url || !key) {
    supabaseClient = null;
    return supabaseClient;
  }

  try {
    supabaseClient = createClient(url, key);
  } catch {
    supabaseClient = null;
  }

  return supabaseClient;
}

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
  const supabase = getSupabaseClient();

  const tasks: Array<PromiseLike<unknown> | unknown> = [
    prisma.user
      .update({
        where: {
          id: userId,
        },
        data: {
          name,
          displayName: name,
          image,
        },
      })
      .catch(() => undefined),
    syncLocalMarketIdentity(userId, name, image),
    syncLocalDealIdentity(userId, name, image),
  ];

  if (supabase) {
    tasks.push(
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
        .eq("senderId", userId)
    );
  }

  await Promise.allSettled(tasks);
}
