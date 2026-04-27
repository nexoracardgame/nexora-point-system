import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createLocalNotification } from "@/lib/local-notification-store";
import {
  createFriendRequestRecord,
  getFriendRelation,
  listFriendsForUser,
  removeFriendship,
  respondToFriendRequest,
} from "@/lib/friend-store";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();
  if (!userId) {
    return NextResponse.json({ friends: [] }, { status: 401 });
  }

  const friends = await listFriendsForUser(userId);
  return NextResponse.json({ friends });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();
  const sessionUser = session?.user;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const action = String(body?.action || "request").trim();

  if (action === "request") {
    const targetUserId = String(body?.targetUserId || "").trim();
    const request = await createFriendRequestRecord(userId, targetUserId);
    const senderProfile = await getLocalProfileByUserId(userId);

    await createLocalNotification({
      userId: targetUserId,
      type: "friend",
      title: `${senderProfile?.displayName || sessionUser?.name || "NEXORA User"} ส่งคำขอเป็นเพื่อน`,
      body: "กดดูรายละเอียดเพื่อยอมรับหรือปฏิเสธคำขอเป็นเพื่อน",
      href: "/community",
      image: senderProfile?.image || String(sessionUser?.image || "/avatar.png"),
      meta: {
        requestId: request.id,
        fromUserId: userId,
        action: "request",
      },
    });

    const relation = await getFriendRelation(userId, targetUserId);
    return NextResponse.json({ success: true, relation });
  }

  if (action === "respond") {
    const requestId = String(body?.requestId || "").trim();
    const decision = String(body?.decision || "").trim() === "accept" ? "accept" : "reject";
    const result = await respondToFriendRequest(requestId, userId, decision);

    if (decision === "accept") {
      const currentProfile = await getLocalProfileByUserId(userId);
      await createLocalNotification({
        userId: result.request.fromUserId,
        type: "friend",
        title: `${currentProfile?.displayName || sessionUser?.name || "NEXORA User"} ตอบรับคำขอเป็นเพื่อน`,
        body: "ตอนนี้คุณเป็นเพื่อนกันแล้ว ดูรายชื่อเพื่อนได้ที่หน้า Community",
        href: "/community",
        image: currentProfile?.image || String(sessionUser?.image || "/avatar.png"),
        meta: {
          requestId: result.request.id,
          fromUserId: userId,
          action: "accepted",
        },
      });
    }

    return NextResponse.json({ success: true, status: result.request.status });
  }

  if (action === "remove") {
    const targetUserId = String(body?.targetUserId || "").trim();
    await removeFriendship(userId, targetUserId);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
