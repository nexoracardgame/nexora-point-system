import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDmRoomsForUser } from "@/lib/dm-list";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const session = await getServerSession(authOptions);
  const myId = session?.user?.id;
  const myLineId = (session?.user as { lineId?: string } | undefined)?.lineId;

  if (!myId) {
    return NextResponse.json(
      { rooms: [] },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  let result;
  try {
    result = await getDmRoomsForUser(String(myId), myLineId);
  } catch (error) {
    console.error("DM list unavailable", error);
    return NextResponse.json({ error: "DM_LIST_UNAVAILABLE" }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }

  return NextResponse.json(
    { rooms: result },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
