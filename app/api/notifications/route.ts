import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccessibleRoomIds } from "@/lib/dm-access";
import { getLocalNotificationsForUser } from "@/lib/local-notification-store";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseClient } from "@/lib/supabase-server";

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
    const supabase = getServerSupabaseClient();
    const session = await getServerSession(authOptions);
    const currentUserId = String(session?.user?.id || "").trim();
    const currentLineId = String(session?.user?.lineId || "").trim();

    if (!currentUserId) {
      return NextResponse.json(
        { items: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { items: [] },
        { headers: { "Cache-Control": "no-store" }, status: 500 }
      );
    }

    const [allowedRoomIds, localNotifications] = await Promise.all([
      getAccessibleRoomIds(currentUserId, currentLineId),
      getLocalNotificationsForUser(currentUserId, {
        unreadOnly: true,
        limit: 60,
      }),
    ]);

    if (allowedRoomIds.length === 0) {
      return NextResponse.json(
        {
          items: localNotifications
            .map((item) => ({
              id: item.id,
              type: item.type,
              title: item.title,
              body: item.body,
              href: item.href,
              image: safeImage(item.image),
              createdAt: item.createdAt,
            }))
            .slice(0, 60),
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const [roomResult, unreadResult, acceptedDeals] = await Promise.all([
      supabase
        .from("dm_room")
        .select("roomid,usera,userb,useraname,useraimage,userbname,userbimage")
        .in(
          "roomid",
          allowedRoomIds.filter((roomId) => !roomId.startsWith("deal:"))
        ),
      supabase
        .from("dmMessage")
        .select("id,roomId,senderId,senderName,senderImage,content,imageUrl,createdAt")
        .in("roomId", allowedRoomIds)
        .neq("senderId", currentUserId)
        .neq("senderId", currentLineId || "__never__")
        .is("seenAt", null)
        .order("createdAt", { ascending: false })
        .limit(60),
      prisma.dealRequest.findMany({
        where: {
          status: "accepted",
          OR: [{ buyerId: currentUserId }, { sellerId: currentUserId }],
        },
        include: {
          buyer: {
            select: {
              id: true,
              displayName: true,
              name: true,
              image: true,
            },
          },
          seller: {
            select: {
              id: true,
              displayName: true,
              name: true,
              image: true,
            },
          },
        },
      }),
    ]);

    if (roomResult.error) {
      console.error("NOTIFICATION ROOM ERROR:", roomResult.error);
    }

    if (unreadResult.error) {
      console.error("NOTIFICATION MESSAGE ERROR:", unreadResult.error);
    }

    const roomById = new Map((roomResult.data || []).map((room) => [room.roomid, room]));
    const relevantUnreadRows = unreadResult.data || [];

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
    const dealById = new Map(acceptedDeals.map((deal) => [deal.id, deal]));

    const chatNotifications: NotificationItem[] = relevantUnreadRows.map((row) => {
      const roomId = String(row.roomId || "");
      const senderId = String(row.senderId || "").trim();
      const senderProfile = profileByUserId.get(senderId);

      if (roomId.startsWith("deal:")) {
        const dealId = roomId.replace(/^deal:/, "");
        const deal = dealById.get(dealId);
        const fallbackName =
          deal?.buyerId === currentUserId
            ? deal?.seller.displayName || deal?.seller.name
            : deal?.buyer.displayName || deal?.buyer.name;
        const fallbackImage =
          deal?.buyerId === currentUserId
            ? deal?.seller.image
            : deal?.buyer.image;

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
