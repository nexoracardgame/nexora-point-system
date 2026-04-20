import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { authOptions } from "@/lib/auth";
import { markLocalNotificationsRead } from "@/lib/local-notification-store";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = String(session?.user?.id || "").trim();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const ids = Array.isArray(body?.ids)
      ? body.ids.map((id: unknown) => String(id || "").trim()).filter(Boolean)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "Missing notification ids" }, { status: 400 });
    }

    const chatMessageIds = ids
      .filter(
        (id: string) => id.startsWith("chat-") || id.startsWith("deal-chat-")
      )
      .map((id: string) => id.replace(/^deal-chat-/, "").replace(/^chat-/, ""))
      .filter((id: string) => Boolean(id));

    const storedNotificationIds = ids.filter(
      (id: string) => !id.startsWith("chat-") && !id.startsWith("deal-chat-")
    );

    const supabase = getSupabaseClient();
    const readAt = new Date().toISOString();

    if (supabase && chatMessageIds.length > 0) {
      await supabase
        .from("dmMessage")
        .update({ seenAt: readAt })
        .in("id", chatMessageIds)
        .neq("senderId", userId)
        .is("seenAt", null);
    }

    const updated =
      storedNotificationIds.length > 0
        ? await markLocalNotificationsRead(userId, storedNotificationIds)
        : [];

    return NextResponse.json(
      {
        success: true,
        updatedIds: [
          ...updated.map((item) => item.id),
          ...ids.filter(
            (id: string) =>
              id.startsWith("chat-") || id.startsWith("deal-chat-")
          ),
        ],
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch {
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }
}
