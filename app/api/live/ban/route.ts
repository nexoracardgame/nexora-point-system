import { NextResponse } from "next/server";
import { getApiActor } from "@/lib/admin-auth";
import {
  banLiveBroadcaster,
  getActiveLiveBroadcastBan,
  unbanLiveBroadcaster,
} from "@/lib/live-broadcast";

export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function statusForReason(reason?: string) {
  if (reason === "target_required") return 400;
  if (reason === "cannot_ban_self") return 409;
  return 403;
}

export async function POST(request: Request) {
  const actor = await getApiActor();
  if (!actor) {
    return noStoreJson({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const targetUserId = String(body?.userId || body?.targetUserId || "").trim();
    const reason = String(body?.reason || "").trim();
    const result = await banLiveBroadcaster({
      targetUserId,
      actorUserId: actor.id,
      actorRole: actor.role,
      actorName: actor.name || actor.lineId || "NEXORA Admin",
      reason,
    });

    if (!result.ok) {
      return noStoreJson(
        { error: result.reason },
        { status: statusForReason(result.reason) }
      );
    }

    return noStoreJson({
      ban: result.ban,
      active: result.active,
    });
  } catch (error) {
    console.error("LIVE BAN ERROR:", error);
    return noStoreJson({ error: "failed_to_ban_live" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const actor = await getApiActor();
  if (!actor) {
    return noStoreJson({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const targetUserId = String(body?.userId || body?.targetUserId || "").trim();
    const result = await unbanLiveBroadcaster({
      targetUserId,
      actorRole: actor.role,
    });

    if (!result.ok) {
      return noStoreJson(
        { error: result.reason },
        { status: statusForReason(result.reason) }
      );
    }

    return noStoreJson({
      ban: await getActiveLiveBroadcastBan(targetUserId),
      active: result.active,
    });
  } catch (error) {
    console.error("LIVE UNBAN ERROR:", error);
    return noStoreJson({ error: "failed_to_unban_live" }, { status: 500 });
  }
}
