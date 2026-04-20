import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveUserIdentity } from "@/lib/user-identity";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const identity = await resolveUserIdentity(session?.user);
  const senderId = identity.userId;

  if (!senderId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const roomId = String(body?.roomId || "").trim();
  const content = String(body?.content || "").trim();
  const imageUrl = String(body?.imageUrl || "").trim();

  if (!roomId) {
    return NextResponse.json({ error: "missing roomId" }, { status: 400 });
  }

  if (!content && !imageUrl) {
    return NextResponse.json({ error: "empty message" }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ error: "system unavailable" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("dmMessage")
    .insert({
      roomId,
      senderId,
      content: content || null,
      imageUrl: imageUrl || null,
      senderName: identity.name,
      senderImage: identity.image,
    })
    .select("*")
    .single();

  if (error) {
    console.error("SEND DM API ERROR:", error);
    return NextResponse.json({ error: "send failed" }, { status: 500 });
  }

  await supabase
    .from("dm_room")
    .update({ updatedat: new Date().toISOString() })
    .eq("roomid", roomId);

  return NextResponse.json(data);
}
