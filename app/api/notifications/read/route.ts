import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccessibleRoomIds } from "@/lib/dm-access";
import { markLocalNotificationsRead } from "@/lib/local-notification-store";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = String(session?.user?.id || "").trim();
    const lineId = String(
      ((session?.user || {}) as { lineId?: string }).lineId || ""
    ).trim();

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

    const supabase = getServerSupabaseClient();
    const readAt = new Date().toISOString();

    if (supabase && chatMessageIds.length > 0) {
      const allowedRoomIds = await getAccessibleRoomIds(userId, lineId);
      const { data: allowedMessages } = await supabase
        .from("dmMessage")
        .select("id")
        .in("id", chatMessageIds)
        .in("roomId", allowedRoomIds);

      const allowedMessageIds = (allowedMessages || [])
        .map((row) => String(row.id || "").trim())
        .filter(Boolean);

      await supabase
        .from("dmMessage")
        .update({ seenAt: readAt })
        .in("id", allowedMessageIds)
        .neq("senderId", userId)
        .neq("senderId", lineId || "__never__")
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
