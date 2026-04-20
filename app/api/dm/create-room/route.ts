import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "@/lib/auth";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";
import { resolveUserIdentity } from "@/lib/user-identity";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function safeName(name?: string | null, fallback = "User") {
  const value = String(name || "").trim();
  return value || fallback;
}

function safeImage(image?: string | null) {
  const value = String(image || "").trim();
  return value || "/avatar.png";
}

function buildRoomId(userA: string, userB: string) {
  return [userA, userB].sort().join("__");
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const identity = await resolveUserIdentity(session?.user);
    const user1 = identity.userId;

    if (!user1) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบ" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const user2 = String(body?.user2 || "").trim();
    const user2Name = String(body?.user2Name || "").trim();
    const user2Image = String(body?.user2Image || "").trim();

    if (!user2) {
      return NextResponse.json(
        { error: "ไม่พบผู้ใช้ปลายทาง" },
        { status: 400 }
      );
    }

    if (user1 === user2) {
      return NextResponse.json(
        { error: "ไม่สามารถแชทกับตัวเองได้" },
        { status: 400 }
      );
    }

    const [currentProfile, targetProfile] = await Promise.all([
      getLocalProfileByUserId(user1),
      getLocalProfileByUserId(user2),
    ]);

    const roomId = buildRoomId(user1, user2);
    const nowIso = new Date().toISOString();

    const { error: upsertError } = await supabase.from("dm_room").upsert({
      roomid: roomId,
      usera: user1,
      userb: user2,
      useraname: safeName(currentProfile?.displayName || identity.name, "You"),
      useraimage: safeImage(currentProfile?.image || identity.image),
      userbname: safeName(targetProfile?.displayName || user2Name),
      userbimage: safeImage(targetProfile?.image || user2Image),
      updatedat: nowIso,
    });

    if (upsertError) {
      return NextResponse.json(
        { error: "ไม่สามารถสร้างห้องแชทได้" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      roomId,
    });
  } catch {
    return NextResponse.json(
      { error: "ระบบเกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}
