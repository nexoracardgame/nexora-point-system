import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getWalletNotificationCount,
  markWalletNotificationsRead,
} from "@/lib/local-notification-store";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();

  if (!userId) {
    return NextResponse.json({ count: 0 }, { status: 401 });
  }

  const count = await getWalletNotificationCount(userId);
  return NextResponse.json(
    { count },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();

  if (!userId) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const updated = await markWalletNotificationsRead(userId);
  return NextResponse.json(
    { success: true, updated: updated.length },
    { headers: { "Cache-Control": "no-store" } }
  );
}
