import { NextResponse } from "next/server";
import { getApiActor } from "@/lib/admin-auth";
import {
  buildLiveEmbed,
  createLiveBroadcast,
  getActiveLiveBroadcastBan,
  getActiveLiveBroadcast,
  isLiveModeratorRole,
  stopLiveBroadcast,
  touchLiveBroadcast,
} from "@/lib/live-broadcast";

export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export async function GET() {
  try {
    const actor = await getApiActor().catch(() => null);
    const active = await getActiveLiveBroadcast(undefined, {
      ensureSchema: false,
      expireOld: false,
    }).catch((error) => {
      console.error("LIVE GET ACTIVE ERROR:", error);
      return null;
    });
    const [viewerBan, activeOwnerBan] = await Promise.all([
      actor
        ? getActiveLiveBroadcastBan(actor.id, undefined, {
            ensureSchema: false,
          }).catch(() => null)
        : Promise.resolve(null),
      active?.ownerUserId
        ? getActiveLiveBroadcastBan(active.ownerUserId, undefined, {
            ensureSchema: false,
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

    return noStoreJson({
      active,
      viewerBan,
      activeOwnerBan,
      canModerate: actor ? isLiveModeratorRole(actor.role) : false,
    });
  } catch (error) {
    console.error("LIVE GET ERROR:", error);
    return noStoreJson(
      {
        active: null,
        viewerBan: null,
        activeOwnerBan: null,
        canModerate: false,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const actor = await getApiActor();
  if (!actor) {
    return noStoreJson({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const sourceUrl = String(body?.url || body?.sourceUrl || "").trim();

    if (!sourceUrl) {
      return noStoreJson({ error: "empty_url" }, { status: 400 });
    }

    buildLiveEmbed(sourceUrl);

    const result = await createLiveBroadcast({
      sourceUrl,
      ownerUserId: actor.id,
      ownerName: actor.name || actor.lineId || "NEXORA",
    });

    if (!result.ok) {
      if (result.reason === "banned") {
        return noStoreJson(
          { error: "live_banned", ban: result.ban },
          { status: 403 }
        );
      }

      return noStoreJson(
        { error: "busy", active: result.active },
        { status: 409 }
      );
    }

    return noStoreJson({ active: result.active });
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_url";
    const status =
      message === "unsupported_platform" ||
      message === "unsupported_youtube_url" ||
      message === "invalid_protocol" ||
      message === "invalid_url" ||
      message === "empty_url"
        ? 400
        : 500;

    if (status >= 500) {
      console.error("LIVE POST ERROR:", error);
    }

    return noStoreJson({ error: message }, { status });
  }
}

export async function DELETE() {
  const actor = await getApiActor();
  if (!actor) {
    return noStoreJson({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await stopLiveBroadcast({
      actorUserId: actor.id,
      actorRole: actor.role,
    });

    if (!result.ok) {
      return noStoreJson(
        { error: result.reason, active: result.active },
        { status: 403 }
      );
    }

    return noStoreJson({ active: result.active });
  } catch (error) {
    console.error("LIVE DELETE ERROR:", error);
    return noStoreJson({ error: "failed_to_stop_live" }, { status: 500 });
  }
}

export async function PATCH() {
  const actor = await getApiActor();
  if (!actor) {
    return noStoreJson({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await touchLiveBroadcast({
      actorUserId: actor.id,
      actorRole: actor.role,
    });

    if (!result.ok) {
      return noStoreJson(
        { error: result.reason, active: result.active },
        { status: 403 }
      );
    }

    return noStoreJson({ active: result.active });
  } catch (error) {
    console.error("LIVE PATCH ERROR:", error);
    return noStoreJson({ error: "failed_to_touch_live" }, { status: 500 });
  }
}
