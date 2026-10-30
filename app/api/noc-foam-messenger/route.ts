import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_SCRIPT = "https://script.google.com/macros/s/AKfycbzCJozWvXbAfgQk_WcuudfKO-uzCDO3NyCDDdsTFbiUFvxWfXBgHe8xCZhBYHKyEN1F/exec";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const equal = (a: string, b: string) => {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = process.env.NOC_META_VERIFY_TOKEN;
  if (!token) return json({ error: "Messenger is not configured" }, 503);
  if (params.get("hub.mode") !== "subscribe" || !equal(params.get("hub.verify_token") || "", token)) return json({ error: "Verification failed" }, 403);
  const challenge = params.get("hub.challenge");
  if (!challenge || !/^\d{1,100}$/.test(challenge)) return json({ error: "Invalid challenge" }, 400);
  return new Response(challenge, { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const appSecret = process.env.NOC_META_APP_SECRET;
  const pageId = process.env.NOC_META_PAGE_ID;
  const bridgeSecret = process.env.NOC_FOAM_WEBHOOK_SECRET;
  if (!appSecret || !bridgeSecret || !pageId || !/^\d{5,30}$/.test(pageId)) return json({ error: "Messenger is not configured" }, 503);
  if (Number(request.headers.get("content-length")) > 1048576) return json({ error: "Payload too large" }, 413);
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > 1048576) return json({ error: "Payload too large" }, 413);
  const signature = request.headers.get("x-hub-signature-256") || "";
  const expected = "sha256=" + createHmac("sha256", appSecret).update(raw).digest("hex");
  if (!/^sha256=[a-f0-9]{64}$/i.test(signature) || !equal(signature, expected)) return json({ error: "Invalid signature" }, 401);
  let body;
  try { body = JSON.parse(raw.toString("utf8")); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!body || body.object !== "page" || !Array.isArray(body.entry)) return json({ error: "Invalid page event" }, 400);
  const entries = body.entry.filter((entry: { id?: unknown }) => String(entry?.id || "") === pageId);
  if (!entries.length) return json({ ok: true, ignored: true });
  // Bind the authenticated, page-filtered bytes to a short-lived internal envelope.
  const payload = JSON.stringify({ object: "page", entry: entries }).replace(/[\u007f-\uffff]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  const timestamp = String(Date.now());
  const signed = createHmac("sha256", bridgeSecret).update("noc-messenger-ingress-v1\n" + timestamp + "\n" + payload).digest("hex");
  const target = new URL(process.env.NOC_FOAM_APPS_SCRIPT_WEBHOOK_URL || DEFAULT_SCRIPT);
  if (target.protocol !== "https:" || target.hostname !== "script.google.com") return json({ error: "Invalid upstream configuration" }, 503);
  target.searchParams.set("secret", bridgeSecret);
  try {
    const response = await fetch(target, {
      method: "POST", headers: { "Content-Type": "application/json" }, redirect: "follow", signal: AbortSignal.timeout(55000),
      body: JSON.stringify({ messengerEnvelope: { timestamp, signature: signed, body: payload } }),
    });
    const result = await response.json();
    if (!response.ok || result?.ok !== true) return json({ error: "Messenger processing unavailable" }, 503);
    return json({ ok: true });
  } catch { return json({ error: "Messenger processing unavailable" }, 503); }
}
