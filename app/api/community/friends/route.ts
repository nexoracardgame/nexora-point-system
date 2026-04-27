import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createLocalNotification,
  markLocalFriendRequestNotificationsRead,
} from "@/lib/local-notification-store";
import {
  createFriendRequestRecord,
  getFriendRelation,
  listIncomingFriendRequests,
  listFriendsForUser,
  removeFriendship,
  respondToFriendRequest,
} from "@/lib/friend-store";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";

function getSessionIds(session: Awaited<ReturnType<typeof getServerSession>>) {
  const sessionUser = (session as { user?: { id?: string; lineId?: string } } | null)?.user;
  const userId = String(sessionUser?.id || "").trim();
  const lineId = String(
    sessionUser?.lineId || ""
  ).trim();

  return {
    userId,
    lineId,
    aliases: lineId ? [userId, lineId] : [userId],
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const { userId, lineId } = getSessionIds(session);

  if (!userId) {
    return NextResponse.json({ friends: [], requests: [] }, { status: 401 });
  }

  const [friends, requests] = await Promise.all([
    listFriendsForUser(userId),
    listIncomingFriendRequests(userId, lineId ? [lineId] : []),
  ]);

  return NextResponse.json(
    { friends, requests },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const { userId, lineId, aliases } = getSessionIds(session);
  const sessionUser = session?.user;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "request").trim();

  if (action === "request") {
    const targetUserId = String(body?.targetUserId || "").trim();
    if (!targetUserId || aliases.includes(targetUserId)) {
      return NextResponse.json(
        { error: "Cannot add yourself" },
        { status: 400 }
      );
    }
    const request = await createFriendRequestRecord(userId, targetUserId);
    const senderProfile = await getLocalProfileByUserId(userId);

    if (request.shouldNotify) {
      await createLocalNotification({
        userId: targetUserId,
        type: "friend",
        title: `${senderProfile?.displayName || sessionUser?.name || "NEXORA User"} ส่งคำขอเป็นเพื่อน`,
        body: "กดยอมรับหรือปฏิเสธคำขอเป็นเพื่อนได้จากกระดิ่งหรือหน้า Community",
        href: "/community",
        image:
          senderProfile?.image || String(sessionUser?.image || "/avatar.png"),
        meta: {
          requestId: request.id,
          fromUserId: userId,
          action: "request",
        },
      });
    }

    const relation = await getFriendRelation(userId, targetUserId);

    return NextResponse.json(
      {
        success: true,
        relation,
        notified: Boolean(request.shouldNotify),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (action === "respond") {
    const requestId = String(body?.requestId || "").trim();
    const decision =
      String(body?.decision || "").trim() === "accept" ? "accept" : "reject";
    const result = await respondToFriendRequest(requestId, aliases, decision);

    await markLocalFriendRequestNotificationsRead(aliases, requestId).catch(
      () => undefined
    );

    if (decision === "accept") {
      const currentProfile = await getLocalProfileByUserId(userId);
      await createLocalNotification({
        userId: result.request.fromUserId,
        type: "friend",
        title: `${currentProfile?.displayName || sessionUser?.name || "NEXORA User"} ตอบรับคำขอเป็นเพื่อน`,
        body: "ตอนนี้เป็นเพื่อนกันแล้ว ดูรายชื่อเพื่อนได้ที่หน้า Community",
        href: "/community",
        image:
          currentProfile?.image || String(sessionUser?.image || "/avatar.png"),
        meta: {
          requestId: result.request.id,
          fromUserId: userId,
          action: "accepted",
        },
      });
    }

    return NextResponse.json(
      { success: true, status: result.request.status },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (action === "remove") {
    const targetUserId = String(body?.targetUserId || "").trim();
    await removeFriendship(userId, targetUserId);
    const currentProfile = await getLocalProfileByUserId(userId);
    await createLocalNotification({
      userId: targetUserId,
      type: "friend",
      title: `${currentProfile?.displayName || sessionUser?.name || "NEXORA User"} ลบคุณออกจากเพื่อน`,
      body: "รายชื่อนี้ถูกลบออกจาก Community แล้ว",
      href: "/community",
      image: currentProfile?.image || String(sessionUser?.image || "/avatar.png"),
      meta: {
        fromUserId: userId,
        action: "removed",
      },
    }).catch(() => undefined);
    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
