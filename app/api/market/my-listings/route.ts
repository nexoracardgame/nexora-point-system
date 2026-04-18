export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  if (!userId) {
    return NextResponse.json({ items: [] });
  }

  const items = await prisma.marketListing.findMany({
    where: {
      sellerId: userId,
      NOT: { status: "sold" },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ items });
}