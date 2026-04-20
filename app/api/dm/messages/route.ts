import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();
  const roomId = req.nextUrl.searchParams.get("roomId");

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!roomId) {
    return NextResponse.json({ error: "missing roomId" }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ error: "system unavailable" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("dmMessage")
    .select("*")
    .eq("roomId", String(roomId))
    .order("createdAt", { ascending: true });

  if (error) {
    console.error("LOAD DM API MESSAGE ERROR:", error);
    return NextResponse.json({ error: "load failed" }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
