import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDmRoomAccess } from "@/lib/dm-access";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("roomId");

  if (!roomId) {
    return NextResponse.json({ error: "no roomId" }, { status: 400 });
  }

  const myId = String(session.user.id || "").trim();
  const lineId = String(
    ((session.user || {}) as { lineId?: string }).lineId || ""
  ).trim();
  const access = await getDmRoomAccess({
    roomId,
    userId: myId,
    lineId,
  });

  if (!access.ok || access.kind !== "direct") {
    const status =
      !access.ok && access.reason === "not-found"
        ? 404
        : !access.ok && access.reason === "closed"
          ? 409
          : 403;

    return NextResponse.json({ error: "forbidden" }, { status });
  }

  const roomUserAIsMe = access.room.usera === myId || access.room.usera === lineId;
  const otherUserId = access.otherUserId;
  const otherProfile = otherUserId ? await getLocalProfileByUserId(otherUserId) : null;

  return NextResponse.json({
    otherUser: {
      id: otherUserId,
      name:
        otherProfile?.displayName ||
        (roomUserAIsMe ? access.room.userbname : access.room.useraname) ||
        "User",
      image:
        otherProfile?.image ||
        (roomUserAIsMe ? access.room.userbimage : access.room.useraimage) ||
        "/avatar.png",
    },
  });
}
