import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

  const room = await prisma.dmRoom.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // 🔥 หาอีกฝ่ายจริง
  const myId = session.user.id;

  let otherId = null;

  if (room.user1 === myId) {
    otherId = room.user2;
  } else {
    otherId = room.user1;
  }

  // 🔥 ดึง user จริงจาก DB
  const otherUser = await prisma.user.findUnique({
    where: { id: otherId },
    select: {
      id: true,
      name: true,
      image: true,
    },
  });

  if (!otherUser) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  return NextResponse.json({
    otherUser: {
      id: otherUser.id,
      name: otherUser.name || "User",
      image: otherUser.image || "/avatar.png",
    },
  });
}