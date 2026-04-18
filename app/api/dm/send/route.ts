import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const senderId = (session?.user as any)?.id;

  const body = await req.json();

  const msg = await prisma.dmMessage.create({
    data: {
      roomId: body.roomId,
      senderId,
      content: body.content,
    },
  });

  return NextResponse.json(msg);
}