import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDmRoomsForUser } from "@/lib/dm-list";

export async function GET() {
  const session = await getServerSession(authOptions);
  const myId = session?.user?.id;
  const myLineId = (session?.user as { lineId?: string } | undefined)?.lineId;

  if (!myId) {
    return NextResponse.json({ rooms: [] }, { status: 200 });
  }

  const result = await getDmRoomsForUser(String(myId), myLineId);

  return NextResponse.json({ rooms: result });
}
