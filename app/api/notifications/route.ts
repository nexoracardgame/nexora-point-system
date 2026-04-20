import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "@/lib/auth";
import { isDealChatRoomId } from "@/lib/deal-chat";
import { getAllLocalDeals } from "@/lib/local-deal-store";
import { getLocalNotificationsForUser } from "@/lib/local-notification-store";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type NotificationItem = {
  id: string;
  type: "chat" | "deal" | "wishlist";
  title: string;
  body: string;
  href: string;
  image: string;
  createdAt: string;
};

function safeImage(image?: string | null, fallback?: string | null) {
  return String(image || fallback || "").trim() || "/avatar.png";
}

function safeName(name?: string | null, fallback?: string | null) {
  return String(name || fallback || "").trim() || "NEXORA User";
}

function buildPreview(content?: string | null, imageUrl?: string | null) {
  const text = String(content || "").trim();
  if (text) return text;
  if (imageUrl) return "ส่งรูปภาพ";
  return "ส่งข้อความ";
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const currentUserId = String(session?.user?.id || "").trim();
    const currentLineId = String(session?.user?.lineId || "").trim();

    if (!currentUserId) {
      return NextResponse.json(
        { items: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const [
      roomResult,
      unreadResult,
      localDeals,
      localNotifications,
    ] = await Promise.all([
      supabase
        .from("dm_room")
        .select("roomid,usera,userb,useraname,useraimage,userbname,userbimage"),
      supabase
        .from("dmMessage")
        .select("id,roomId,senderId,senderName,senderImage,content,imageUrl,createdAt")
        .neq("senderId", currentUserId)
        .neq("senderId", currentLineId || "__never__")
        .is("seenAt", null)
        .order("createdAt", { ascending: false })
        .limit(60),
      getAllLocalDeals(),
      getLocalNotificationsForUser(currentUserId, {
        unreadOnly: true,
        limit: 60,
      }),
    ]);

    if (roomResult.error) {
      console.error("NOTIFICATION ROOM ERROR:", roomResult.error);
    }

    if (unreadResult.error) {
      console.error("NOTIFICATION MESSAGE ERROR:", unreadResult.error);
    }

    const rooms = roomResult.data || [];
    const unreadRows = unreadResult.data || [];

    const myRooms = rooms.filter(
      (room) =>
        room.usera === currentUserId ||
        room.userb === currentUserId ||
        (currentLineId
          ? room.usera === currentLineId || room.userb === currentLineId
          : false)
    );

    const roomById = new Map(myRooms.map((room) => [room.roomid, room]));
    const regularRoomIds = new Set(myRooms.map((room) => room.roomid));

    const relevantUnreadRows = unreadRows.filter((row) => {
      const roomId = String(row.roomId || "");
      return regularRoomIds.has(roomId) || isDealChatRoomId(roomId);
    });

    const unreadSenderIds = Array.from(
      new Set(
        relevantUnreadRows
          .map((row) => String(row.senderId || "").trim())
          .filter(Boolean)
      )
    );

    const profileEntries = await Promise.all(
      unreadSenderIds.map(async (senderId) => [
        senderId,
        await getLocalProfileByUserId(senderId),
      ] as const)
    );

    const profileByUserId = new Map(profileEntries);
    const dealById = new Map(localDeals.map((deal) => [deal.id, deal]));

    const chatNotifications: NotificationItem[] = relevantUnreadRows.map((row) => {
      const roomId = String(row.roomId || "");
      const senderId = String(row.senderId || "").trim();
      const senderProfile = profileByUserId.get(senderId);

      if (isDealChatRoomId(roomId)) {
        const dealId = roomId.replace(/^deal:/, "");
        const deal = dealById.get(dealId);
        const fallbackName =
          deal?.buyerId === currentUserId ? deal?.sellerName : deal?.buyerName;
        const fallbackImage =
          deal?.buyerId === currentUserId ? deal?.sellerImage : deal?.buyerImage;

        return {
          id: `deal-chat-${row.id}`,
          type: "chat",
          title: safeName(
            row.senderName || senderProfile?.displayName,
            fallbackName
          ),
          body: `แชทดีล: ${buildPreview(row.content, row.imageUrl)}`,
          href: `/market/deals/chat/${dealId}`,
          image: safeImage(
            row.senderImage || senderProfile?.image,
            fallbackImage
          ),
          createdAt: String(row.createdAt || new Date().toISOString()),
        };
      }

      const room = roomById.get(roomId);
      const fallbackName =
        senderId === room?.usera ? room?.useraname : room?.userbname;
      const fallbackImage =
        senderId === room?.usera ? room?.useraimage : room?.userbimage;

      return {
        id: `chat-${row.id}`,
        type: "chat",
        title: safeName(
          row.senderName || senderProfile?.displayName,
          fallbackName
        ),
        body: buildPreview(row.content, row.imageUrl),
        href: `/dm/${roomId}`,
        image: safeImage(
          row.senderImage || senderProfile?.image,
          fallbackImage
        ),
        createdAt: String(row.createdAt || new Date().toISOString()),
      };
    });

    const storedNotifications: NotificationItem[] = localNotifications.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      body: item.body,
      href: item.href,
      image: safeImage(item.image),
      createdAt: item.createdAt,
    }));

    const items = [...chatNotifications, ...storedNotifications]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 60);

    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("NOTIFICATION LIST ERROR:", error);

    return NextResponse.json(
      { items: [] },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
