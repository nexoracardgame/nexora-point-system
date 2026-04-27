import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { resolveUserIdentity } from "@/lib/user-identity";

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
    const supabase = getServerSupabaseClient();
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
    const legacyRoomId = String(body?.legacyRoomId || "").trim();

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

    if (!supabase) {
      return NextResponse.json({ error: "system unavailable" }, { status: 500 });
    }

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

    if (legacyRoomId && legacyRoomId !== roomId) {
      const sessionLineId = String(
        ((session?.user || {}) as { lineId?: string }).lineId || ""
      ).trim();
      const { data: legacyRoom } = await supabase
        .from("dm_room")
        .select("roomid,usera,userb")
        .eq("roomid", legacyRoomId)
        .maybeSingle();

      const targetUser = await prisma.user.findFirst({
        where: {
          OR: [{ id: user2 }, { lineId: user2 }],
        },
        select: {
          id: true,
          lineId: true,
        },
      });
      const otherIdentityValues = new Set(
        [user2, targetUser?.id, targetUser?.lineId]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      );
      const legacyUsers = [
        String(legacyRoom?.usera || "").trim(),
        String(legacyRoom?.userb || "").trim(),
      ];
      const includesMe = legacyUsers.some(
        (value) => value === user1 || (sessionLineId ? value === sessionLineId : false)
      );
      const includesOther = legacyUsers.some((value) => otherIdentityValues.has(value));

      if (legacyRoom && includesMe && includesOther) {
        await supabase
          .from("dmMessage")
          .update({ roomId })
          .eq("roomId", legacyRoomId);

        await supabase.from("dm_room").delete().eq("roomid", legacyRoomId);
      }
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
