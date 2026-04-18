import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  if (!userId) {
    return NextResponse.json({ count: 0 });
  }

  const rooms = await prisma.dmRoom.findMany({
    where: {
      OR: [{ user1: userId }, { user2: userId }],
    },
  });

  // ❗ แบบง่าย (ยังไม่ละเอียด read/unread)
  return NextResponse.json({ count: rooms.length });
}