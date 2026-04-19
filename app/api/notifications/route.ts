import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDealChatRoomId } from "@/lib/deal-chat";

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
    const currentUserId = String(session?.user?.id || "").trim();
    const currentLineId = String(session?.user?.lineId || "").trim();

    if (!currentUserId) {
      return NextResponse.json(
        { items: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const [{ data: rooms, error: roomErr }, unreadRows, dealRows, wishlistRows, dealEvents] =
      await Promise.all([
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
            seller: {
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
        prisma.marketHistory.findMany({
          where: {
            action: {
              in: ["deal_accepted", "deal_cancelled", "sold"],
            },
            OR: [
              { sellerId: currentUserId },
              { buyerId: currentUserId },
            ],
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 30,
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

    const roomById = new Map(myRooms.map((room) => [room.roomid, room]));
    const regularRoomIds = new Set(myRooms.map((room) => room.roomid));

    const relevantUnreadRows = (unreadRows.data || []).filter((row) => {
      const roomId = String(row.roomId || "");
      return regularRoomIds.has(roomId) || isDealChatRoomId(roomId);
    });

    const dealChatIds = Array.from(
      new Set(
        relevantUnreadRows
          .map((row) => String(row.roomId || ""))
          .filter((roomId) => isDealChatRoomId(roomId))
          .map((roomId) => roomId.replace(/^deal:/, ""))
      )
    );

    const dealChatDeals = dealChatIds.length
      ? await prisma.dealRequest.findMany({
          where: {
            id: { in: dealChatIds },
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
        })
      : [];

    const dealChatMap = new Map(dealChatDeals.map((deal) => [deal.id, deal]));

    const wishlistUserIds = [...new Set(wishlistRows.map((row) => row.userId))];
    const unreadSenderIds = [
      ...new Set(
        relevantUnreadRows
          .map((row) => String(row.senderId || "").trim())
          .filter(Boolean)
      ),
    ];
    const dealEventUserIds = [
      ...new Set(
        dealEvents
          .flatMap((row) => [row.sellerId, row.buyerId])
          .filter((id): id is string => Boolean(id) && id !== currentUserId)
      ),
    ];

    const notificationUserIds = [
      ...new Set([...wishlistUserIds, ...unreadSenderIds, ...dealEventUserIds]),
    ];

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

    const chatNotifications: NotificationItem[] = relevantUnreadRows.map((row) => {
      const roomId = String(row.roomId || "");
      const senderId = String(row.senderId || "");
      const user = userById.get(senderId) || userByLineId.get(senderId);

      if (isDealChatRoomId(roomId)) {
        const dealId = roomId.replace(/^deal:/, "");
        const deal = dealChatMap.get(dealId);
        const otherUser =
          deal?.buyerId === currentUserId ? deal.seller : deal?.buyer;

        return {
          id: `deal-chat-${row.id}`,
          type: "chat",
          title: safeName(
            row.senderName ||
              user?.displayName ||
              user?.name ||
              otherUser?.displayName ||
              otherUser?.name
          ),
          body: deal
            ? `Deal chat: ${buildPreview(row.content, row.imageUrl)}`
            : buildPreview(row.content, row.imageUrl),
          href: `/market/deals/chat/${dealId}`,
          image: safeImage(
            row.senderImage ||
              user?.image ||
              otherUser?.image ||
              "/avatar.png"
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
          row.senderName || user?.displayName || user?.name || fallbackName
        ),
        body: buildPreview(row.content, row.imageUrl),
        href: `/dm/${roomId}`,
        image: safeImage(row.senderImage || user?.image || fallbackImage),
        createdAt: String(row.createdAt || new Date().toISOString()),
      };
    });

    const dealNotifications: NotificationItem[] = dealRows.map((deal) => ({
      id: `deal-request-${deal.id}`,
      type: "deal",
      title: `${safeName(deal.buyer.displayName || deal.buyer.name)} sent a deal`,
      body: `Offer ฿${Number(deal.offeredPrice).toLocaleString("th-TH")} for your card`,
      href: "/market/deals",
      image: safeImage(deal.buyer.image),
      createdAt: deal.createdAt.toISOString(),
    }));

    const dealEventNotifications: NotificationItem[] = dealEvents.flatMap((row) => {
        const counterpartyId =
          row.sellerId === currentUserId ? row.buyerId : row.sellerId;
        const counterparty = counterpartyId
          ? userById.get(counterpartyId) || userByLineId.get(counterpartyId)
          : null;
        const counterpartyName = safeName(
          counterparty?.displayName || counterparty?.name
        );
        const cardLabel = row.cardName ? String(row.cardName).trim() : "your card";
        const priceLabel = row.price
          ? `฿${Number(row.price).toLocaleString("th-TH")}`
          : "";

        if (row.action === "deal_accepted") {
          const title =
            row.buyerId === currentUserId
              ? `${counterpartyName} accepted your deal`
              : `You accepted ${counterpartyName}'s deal`;

          return [{
            id: `deal-accepted-${row.id}`,
            type: "deal" as const,
            title,
            body: priceLabel
              ? `${cardLabel} at ${priceLabel}`
              : `${cardLabel} was accepted`,
            href: "/market/deals",
            image: safeImage(counterparty?.image, row.imageUrl || "/avatar.png"),
            createdAt: row.createdAt.toISOString(),
          }];
        }

        if (row.action === "deal_cancelled") {
          const title =
            row.buyerId === currentUserId
              ? `${counterpartyName} cancelled the deal`
              : `${counterpartyName} left the deal`;

          return [{
            id: `deal-cancelled-${row.id}`,
            type: "deal" as const,
            title,
            body: `${cardLabel} deal was cancelled`,
            href: "/market/deals",
            image: safeImage(counterparty?.image, row.imageUrl || "/avatar.png"),
            createdAt: row.createdAt.toISOString(),
          }];
        }

        if (row.action === "sold") {
          const title =
            row.buyerId === currentUserId
              ? `You closed the deal successfully`
              : `${counterpartyName} completed the purchase`;

          return [{
            id: `deal-sold-${row.id}`,
            type: "deal" as const,
            title,
            body: priceLabel
              ? `${cardLabel} closed at ${priceLabel}`
              : `${cardLabel} sale is complete`,
            href: "/market/deals",
            image: safeImage(counterparty?.image, row.imageUrl || "/avatar.png"),
            createdAt: row.createdAt.toISOString(),
          }];
        }

        return [];
      });

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

    const items = [
      ...chatNotifications,
      ...dealNotifications,
      ...dealEventNotifications,
      ...wishlistNotifications,
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 60);

    return NextResponse.json(
      {
        items,
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
      { items: [] },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
