import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get("roomId");

  const messages = await prisma.dmMessage.findMany({
    where: { roomId: String(roomId) },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(messages);
}