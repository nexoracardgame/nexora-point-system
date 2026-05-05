import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  deletePushSubscriptionByEndpoint,
  savePushSubscription,
} from "@/lib/push-notification-store";

type PushSubscriptionPayload = {
  endpoint?: string | null;
  keys?: {
    p256dh?: string | null;
    auth?: string | null;
  } | null;
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

function getSessionUserId(session: unknown) {
  return String(
    ((session as { user?: { id?: string | null } } | null)?.user?.id || "")
  ).trim();
}

async function readSubscription(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const subscription = (body?.subscription || body || {}) as PushSubscriptionPayload;

  return {
    endpoint: String(subscription.endpoint || "").trim(),
    p256dh: String(subscription.keys?.p256dh || "").trim(),
    auth: String(subscription.keys?.auth || "").trim(),
  };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = getSessionUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const subscription = await readSubscription(req);

  if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }

  await savePushSubscription({
    userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.p256dh,
    auth: subscription.auth,
    userAgent: req.headers.get("user-agent") || null,
  });

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = getSessionUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const subscription = await readSubscription(req);
  await deletePushSubscriptionByEndpoint(subscription.endpoint);

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
