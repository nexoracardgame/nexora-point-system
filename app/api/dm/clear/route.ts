import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDmRoomAccess } from "@/lib/dm-access";
import {
  clearDmConversationForUser,
  clearDmRoomForUser,
} from "@/lib/dm-room-clear-state";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function buildCanonicalDirectRoomId(userA: string, userB: string) {
  return [String(userA || "").trim(), String(userB || "").trim()]
    .filter(Boolean)
    .sort()
    .join("__");
}

async function resolveUserAliases(rawUserId: string) {
  const value = String(rawUserId || "").trim();

  if (!value) {
    return [];
  }

  const user = await prisma.user
    .findFirst({
      where: {
        OR: [{ id: value }, { lineId: value }],
      },
      select: {
        id: true,
        lineId: true,
      },
    })
    .catch(() => null);

  return Array.from(
    new Set([value, user?.id, user?.lineId].map((item) => String(item || "").trim()).filter(Boolean))
  );
}

async function findDirectRoomIdsForPair(myAliases: string[], otherAliases: string[]) {
  const supabase = getServerSupabaseClient();

  if (!supabase || myAliases.length === 0 || otherAliases.length === 0) {
    return [];
  }

  const filters = Array.from(new Set([...myAliases, ...otherAliases])).flatMap((alias) => [
    `usera.eq.${alias}`,
    `userb.eq.${alias}`,
  ]);

  const { data, error } = await supabase
    .from("dm_room")
    .select("roomid,usera,userb")
    .or(filters.join(","));

  if (error) {
    console.error("DM CLEAR LOOKUP ERROR:", error);
    return [];
  }

  return Array.from(
    new Set(
      (data || [])
        .filter((room) => {
          const userA = String(room.usera || "").trim();
          const userB = String(room.userb || "").trim();
          const touchesMe = myAliases.includes(userA) || myAliases.includes(userB);
          const touchesOther =
            otherAliases.includes(userA) || otherAliases.includes(userB);

          return touchesMe && touchesOther;
        })
        .map((room) => String(room.roomid || "").trim())
        .filter(Boolean)
    )
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();
  const lineId = String(
    (((session?.user as { lineId?: string } | undefined) || {}).lineId || "")
  ).trim();

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const roomId = String(body?.roomId || "").trim();
  const otherUserIdInput = String(body?.otherUserId || "").trim();

  if (!roomId) {
    return NextResponse.json({ error: "missing roomId" }, { status: 400 });
  }

  const access = await getDmRoomAccess({
    roomId,
    userId,
    lineId,
  });

  const myAliases = await resolveUserAliases(userId);
  const canonicalOtherUserId =
    access.ok && access.kind === "direct"
      ? access.otherUserId
      : otherUserIdInput;
  const otherAliases = canonicalOtherUserId
    ? await resolveUserAliases(canonicalOtherUserId)
    : [];
  const relatedRoomIds = await findDirectRoomIdsForPair(myAliases, otherAliases);

  if ((!access.ok || access.kind !== "direct") && relatedRoomIds.length === 0) {
    const status =
      !access.ok && access.reason === "not-found"
        ? 404
        : !access.ok && access.reason === "closed"
          ? 409
          : 403;

    return NextResponse.json({ error: access.ok ? "forbidden" : access.reason }, { status });
  }

  const clearedAt = new Date().toISOString();
  const roomIdsToClear = Array.from(
    new Set([
      roomId,
      access.ok && access.kind === "direct" ? access.roomId : "",
      buildCanonicalDirectRoomId(userId, otherAliases[0] || canonicalOtherUserId),
      ...relatedRoomIds,
    ].filter(Boolean))
  );

  const results = await Promise.all(
    roomIdsToClear.map((targetRoomId) =>
      clearDmRoomForUser(userId, targetRoomId, clearedAt)
    )
  );
  const conversationClearResult = canonicalOtherUserId
    ? await clearDmConversationForUser(userId, canonicalOtherUserId, clearedAt)
    : null;

  if (results.every((value) => !value) && !conversationClearResult) {
    return NextResponse.json({ error: "clear failed" }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      roomId: access.ok && access.kind === "direct" ? access.roomId : roomId,
      clearedRoomIds: roomIdsToClear,
      clearedAt,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
