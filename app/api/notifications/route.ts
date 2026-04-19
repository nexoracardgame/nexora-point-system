import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

function safeImage(image?: string | null) {
  return String(image || "").trim() || "/avatar.png";
}

function safeName(name?: string | null) {
  return String(name || "").trim() || "NEXORA User";
}

function buildPreview(content?: string | null, imageUrl?: string | null) {
  const text = String(content || "").trim();
  if (text) return text;
  if (imageUrl) return "sent a photo";
  return "sent a message";
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const currentUserId = String(session?.user?.id || "");
    const currentLineId = session?.user?.lineId;

    if (!currentUserId) {
      return NextResponse.json(
        { items: [], chatUnreadCount: 0, activityCount: 0 },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const [{ data: rooms, error: roomErr }, dealRows, wishlistRows] =
      await Promise.all([
        supabase.from("dm_room").select("roomid,usera,userb,useraname,useraimage,userbname,userbimage"),
        prisma.dealRequest.findMany({
          where: {
            sellerId: currentUserId,
            status: "pending",
          },
          include: {
            buyer: {
              select: {
                displayName: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        }),
        prisma.wishlist.findMany({
          where: {
            userId: {
              not: currentUserId,
            },
            listing: {
              sellerId: currentUserId,
            },
          },
          include: {
            listing: {
              select: {
                id: true,
                cardNo: true,
                cardName: true,
                imageUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        }),
      ]);

    if (roomErr) {
      console.error("NOTIFICATION ROOM ERROR:", roomErr);
    }

    const myRooms = (rooms || []).filter(
      (room) =>
        room.usera === currentUserId ||
        room.userb === currentUserId ||
        (currentLineId
          ? room.usera === currentLineId || room.userb === currentLineId
          : false)
    );

    const roomIds = myRooms.map((room) => room.roomid);

    let chatRows:
      | {
          id?: string;
          roomId?: string;
          senderId?: string;
          senderName?: string | null;
          senderImage?: string | null;
          content?: string | null;
          imageUrl?: string | null;
          createdAt?: string | null;
        }[]
      | null = [];

    if (roomIds.length > 0) {
      const { data: unreadRows, error: unreadErr } = await supabase
        .from("dmMessage")
        .select("id,roomId,senderId,senderName,senderImage,content,imageUrl,createdAt")
        .in("roomId", roomIds)
        .neq("senderId", currentUserId)
        .neq("senderId", currentLineId || "__never__")
        .is("seenAt", null)
        .order("createdAt", { ascending: false })
        .limit(20);

      if (unreadErr) {
        console.error("NOTIFICATION MESSAGE ERROR:", unreadErr);
      } else {
        chatRows = unreadRows;
      }
    }

    const wishlistUserIds = [...new Set(wishlistRows.map((row) => row.userId))];
    const chatSenderIds = [
      ...new Set(
        (chatRows || [])
          .map((row) => String(row.senderId || "").trim())
          .filter(Boolean)
      ),
    ];

    const notificationUserIds = [...new Set([...wishlistUserIds, ...chatSenderIds])];

    const users = notificationUserIds.length
      ? await prisma.user.findMany({
          where: {
            OR: [
              { id: { in: notificationUserIds } },
              { lineId: { in: notificationUserIds } },
            ],
          },
          select: {
            id: true,
            lineId: true,
            name: true,
            displayName: true,
            image: true,
          },
        })
      : [];

    const userById = new Map(users.map((user) => [user.id, user]));
    const userByLineId = new Map(
      users
        .filter((user) => user.lineId)
        .map((user) => [String(user.lineId), user])
    );
    const roomById = new Map(myRooms.map((room) => [room.roomid, room]));

    const chatNotifications: NotificationItem[] = (chatRows || []).map((row) => {
      const senderId = String(row.senderId || "");
      const user = userById.get(senderId) || userByLineId.get(senderId);
      const room = roomById.get(String(row.roomId || ""));

      const fallbackName =
        senderId === room?.usera ? room?.useraname : room?.userbname;
      const fallbackImage =
        senderId === room?.usera ? room?.useraimage : room?.userbimage;

      return {
        id: `chat-${row.id}`,
        type: "chat",
        title: safeName(
          row.senderName || user?.displayName || user?.name || fallbackName
        ),
        body: buildPreview(row.content, row.imageUrl),
        href: `/dm/${row.roomId}`,
        image: safeImage(row.senderImage || user?.image || fallbackImage),
        createdAt: String(row.createdAt || new Date().toISOString()),
      };
    });

    const dealNotifications: NotificationItem[] = dealRows.map((deal) => ({
      id: `deal-${deal.id}`,
      type: "deal",
      title: `${safeName(deal.buyer.displayName || deal.buyer.name)} sent a deal`,
      body: `Offer ${Number(deal.offeredPrice).toLocaleString()} NEX for your card`,
      href: "/market/deals",
      image: safeImage(deal.buyer.image),
      createdAt: deal.createdAt.toISOString(),
    }));

    const wishlistNotifications: NotificationItem[] = wishlistRows.map((row) => {
      const user = userById.get(row.userId) || userByLineId.get(row.userId);
      const cardNo = String(row.listing.cardNo || "").padStart(3, "0");

      return {
        id: `wishlist-${row.id}`,
        type: "wishlist",
        title: `${safeName(user?.displayName || user?.name)} liked your card`,
        body: row.listing.cardName
          ? `${row.listing.cardName} #${cardNo}`
          : `Card #${cardNo}`,
        href: `/market/card/${row.listing.id}`,
        image: safeImage(user?.image),
        createdAt: row.createdAt.toISOString(),
      };
    });

    const items = [...chatNotifications, ...dealNotifications, ...wishlistNotifications]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 40);

    return NextResponse.json(
      {
        items,
        chatUnreadCount: chatNotifications.length,
        activityCount: dealNotifications.length + wishlistNotifications.length,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("NOTIFICATION LIST ERROR:", error);

    return NextResponse.json(
      { items: [], chatUnreadCount: 0, activityCount: 0 },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
