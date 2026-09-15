import { after, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_APPS_SCRIPT_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbzCJozWvXbAfgQk_WcuudfKO-uzCDO3NyCDDdsTFbiUFvxWfXBgHe8xCZhBYHKyEN1F/exec";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function getAppsScriptWebhookUrl() {
  const baseUrl =
    process.env.NOC_FOAM_APPS_SCRIPT_WEBHOOK_URL || DEFAULT_APPS_SCRIPT_WEBHOOK_URL;
  const secret = process.env.NOC_FOAM_WEBHOOK_SECRET;
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

  after(async () => {
    try {
      const upstream = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": request.headers.get("content-type") || "application/json",
        },
        body: rawBody || JSON.stringify({ events: [] }),
        redirect: "follow",
      });
      if (!upstream.ok) {
        console.error("NOC FOAM LINE WEBHOOK UPSTREAM ERROR:", {
          status: upstream.status,
          body: (await upstream.text().catch(() => "")).slice(0, 500),
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
