import { NextResponse } from "next/server";

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

  try {
    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
      },
      body: rawBody || JSON.stringify({ events: [] }),
      redirect: "follow",
    });
    const text = await upstream.text().catch(() => "");

    return noStoreJson({
      ok: true,
      upstreamOk: upstream.ok,
      upstreamStatus: upstream.status,
      upstreamBody: text.slice(0, 500),
    });
  } catch (error) {
    console.error("NOC FOAM LINE WEBHOOK PROXY ERROR:", error);
    return noStoreJson({
      ok: true,
      upstreamOk: false,
      upstreamStatus: 0,
    });
  }
}
