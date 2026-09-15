import { after, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_APPS_SCRIPT_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbzCJozWvXbAfgQk_WcuudfKO-uzCDO3NyCDDdsTFbiUFvxWfXBgHe8xCZhBYHKyEN1F/exec";
const DEFAULT_WEBHOOK_SECRET = "noc-foam-ai-2026";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function getAppsScriptWebhookUrl() {
  const baseUrl =
    process.env.NOC_FOAM_APPS_SCRIPT_WEBHOOK_URL || DEFAULT_APPS_SCRIPT_WEBHOOK_URL;
  const secret = process.env.NOC_FOAM_WEBHOOK_SECRET || DEFAULT_WEBHOOK_SECRET;
  if (!secret) return baseUrl;

  const url = new URL(baseUrl);
  url.searchParams.set("secret", secret);
  return url.toString();
}

export async function GET() {
  return noStoreJson({
    ok: true,
    service: "noc-foam-line-webhook",
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const targetUrl = getAppsScriptWebhookUrl();
  const contentType = request.headers.get("content-type") || "application/json";
  const parsedBody = safeParseWebhookBody(rawBody);

  console.info("NOC FOAM LINE WEBHOOK RECEIVED:", {
    bytes: rawBody.length,
    contentType,
    eventCount: parsedBody.eventCount,
    eventTypes: parsedBody.eventTypes,
  });

  after(async () => {
    try {
      const upstream = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": contentType,
        },
        body: rawBody || JSON.stringify({ events: [] }),
        redirect: "follow",
      });
      const text = await upstream.text().catch(() => "");
      console.info("NOC FOAM LINE WEBHOOK UPSTREAM:", {
        ok: upstream.ok,
        status: upstream.status,
        body: text.slice(0, 300),
      });
      if (!upstream.ok) {
        console.error("NOC FOAM LINE WEBHOOK UPSTREAM ERROR:", {
          status: upstream.status,
          body: text.slice(0, 500),
        });
      }
    } catch (error) {
      console.error("NOC FOAM LINE WEBHOOK PROXY ERROR:", error);
    }
  });

  return noStoreJson({
    ok: true,
    queued: true,
  });
}

function safeParseWebhookBody(rawBody: string) {
  try {
    const data = JSON.parse(rawBody || "{}") as {
      events?: Array<{ type?: string; message?: { type?: string } }>;
    };
    const events = Array.isArray(data.events) ? data.events : [];
    return {
      eventCount: events.length,
      eventTypes: events.map((event) =>
        [event.type || "unknown", event.message?.type || ""].filter(Boolean).join(":")
      ),
    };
  } catch {
    return {
      eventCount: 0,
      eventTypes: ["invalid-json"],
    };
  }
}
