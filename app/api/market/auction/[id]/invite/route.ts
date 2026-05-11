import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuctionRoomWithBids } from "@/lib/auction-store";
import { areFriends } from "@/lib/friend-store";
import {
  createLocalNotification,
  getLocalNotificationsForUser,
} from "@/lib/local-notification-store";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";
import { resolveUserIdentity } from "@/lib/user-identity";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function routeError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function getSessionAliases(
  sessionUser: { id?: string | null; lineId?: string | null } | undefined,
  identityUserId: string
) {
  return [sessionUser?.id, sessionUser?.lineId, identityUserId]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function isActiveAuction(room: { endsAt: string; status: string }) {
  const endsAt = new Date(room.endsAt).getTime();
  return room.status === "active" && Number.isFinite(endsAt) && Date.now() <= endsAt;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as
      | {
          id?: string | null;
          lineId?: string | null;
          name?: string | null;
          image?: string | null;
        }
      | undefined;
    const identity = await resolveUserIdentity({
      id: String(sessionUser?.id || "").trim() || undefined,
      name: sessionUser?.name || null,
      image: sessionUser?.image || null,
    });
    const inviterId = String(sessionUser?.id || identity.userId || "").trim();
    const inviterAliases = getSessionAliases(sessionUser, identity.userId);

    if (!inviterId) {
      return routeError("กรุณาเข้าสู่ระบบก่อนเชิญเพื่อน", 401);
    }

    const { id } = await params;
    const auctionId = String(id || "").trim();
    const body = await req.json().catch(() => ({}));
    const targetUserId = String(body?.targetUserId || "").trim();

    if (!auctionId) {
      return routeError("ไม่พบรหัสห้องประมูล", 400);
    }

    if (!targetUserId || inviterAliases.includes(targetUserId)) {
      return routeError("เลือกเพื่อนที่ต้องการเชิญให้ถูกต้อง", 400);
    }

    const payload = await getAuctionRoomWithBids(auctionId);
    if (!payload?.room) {
      return routeError("ไม่พบห้องประมูลนี้", 404);
    }

    if (!isActiveAuction(payload.room)) {
      return routeError("ห้องประมูลนี้ปิดแล้ว ไม่สามารถเชิญเพิ่มได้", 400);
    }

    const friendshipOk = await areFriends(inviterId, targetUserId);
    if (!friendshipOk) {
      return routeError("เชิญได้เฉพาะเพื่อนในระบบเท่านั้น", 403);
    }

    const existingNotifications = await getLocalNotificationsForUser(targetUserId, {
      unreadOnly: true,
      limit: 80,
    }).catch(() => []);
    const duplicateInvite = existingNotifications.find(
      (item) =>
        item.type === "auction" &&
        String(item.meta?.action || "") === "auction_invite" &&
        String(item.meta?.auctionId || "") === auctionId &&
        String(item.meta?.fromUserId || "") === inviterId
    );

    if (duplicateInvite) {
      return NextResponse.json(
        {
          success: true,
          alreadyInvited: true,
          notificationId: duplicateInvite.id,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const inviterProfile = await getLocalProfileByUserId(inviterId);
    const inviterName =
      inviterProfile?.displayName || identity.name || sessionUser?.name || "NEXORA User";
    const inviterImage =
      inviterProfile?.image || identity.image || sessionUser?.image || "/avatar.png";
    const roomNumber =
      payload.room.roomNumber > 0
        ? String(payload.room.roomNumber).padStart(3, "0")
        : "---";

    const notification = await createLocalNotification({
      userId: targetUserId,
      type: "auction",
      title: `${inviterName} เชิญคุณเข้าห้องประมูล`,
      body: `ห้อง ${roomNumber} • ${payload.room.cardName} กดตอบรับเพื่อไปยังหน้ากฎและเงื่อนไขก่อนเข้าร่วมห้อง`,
      href: `/market/auction/${encodeURIComponent(auctionId)}`,
      image: inviterImage,
      meta: {
        action: "auction_invite",
        auctionId,
        fromUserId: inviterId,
        inviterName,
        roomNumber,
        cardName: payload.room.cardName,
      },
    });

    return NextResponse.json(
      {
        success: true,
        notificationId: notification.id,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("AUCTION INVITE ERROR:", error);
    return routeError("ส่งคำเชิญเข้าห้องประมูลไม่สำเร็จ", 500);
  }
}
