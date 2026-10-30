import { createHmac, timingSafeEqual } from "node:crypto";
import { inspectNocMetaToken, validateNocPageToken, NOC_META_FOAM_PAGES } from "@/lib/noc-messenger-token-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  return json({ ok: true, service: "noc-foam-messenger-check", revision: "token-debug-v1", mode: "read-only" });
}

export async function POST(request: Request) {
  const secret = process.env.NOC_FOAM_WEBHOOK_SECRET;
  if (!secret) return json({ ok: false, reason: "SERVICE_CONFIG" }, 503);
  const timestamp = request.headers.get("x-noc-timestamp") || "";
  const signature = request.headers.get("x-noc-signature") || "";
  if (!/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 300000 || !/^[a-f0-9]{64}$/.test(signature)) return json({ ok: false, reason: "BRIDGE_AUTH" }, 401);
  if (Number(request.headers.get("content-length")) > 12288) return json({ ok: false }, 413);
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > 12288) return json({ ok: false }, 413);
  const expected = createHmac("sha256", secret).update(Buffer.concat([Buffer.from("noc-messenger-check-v1\n" + timestamp + "\n"), raw])).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) return json({ ok: false, reason: "BRIDGE_AUTH" }, 401);
  const appSecret = process.env.NOC_META_APP_SECRET?.trim();
  if (!appSecret || !/^[a-f0-9]{32}$/i.test(appSecret)) return json({ ok: false, reason: "SERVICE_CONFIG" }, 503);
  let body;
  try { body = JSON.parse(raw.toString("utf8")); } catch { return json({ ok: false }, 400); }
  const pageId = String(body?.pageId || ""), token = String(body?.pageToken || "");
  const allowed = (process.env.NOC_META_PAGE_IDS || process.env.NOC_META_PAGE_ID || "").split(/[\s,]+/);
  if (!NOC_META_FOAM_PAGES.includes(pageId) || !allowed.includes(pageId)) return json({ ok: false, reason: "PAGE_NOT_ALLOWED" }, 400);
  if (!/^[A-Za-z0-9._-]{40,4096}$/.test(token)) return json({ ok: false, reason: "TOKEN_FORMAT" }, 400);
  try {
    const result = await inspectNocMetaToken(token, appSecret);
    if (result.status !== 200 || !result.body?.data || result.body?.error) {
      return json({ ok: false, reason: "META_REJECTED", metaStatus: result.status,
        metaCode: Number.isInteger(result.body?.error?.code) ? Number(result.body?.error?.code) : 0,
        metaSubcode: Number.isInteger(result.body?.error?.error_subcode) ? Number(result.body?.error?.error_subcode) : 0 });
    }
    return json(validateNocPageToken(result.body.data, pageId));
  } catch { return json({ ok: false, reason: "META_UNAVAILABLE" }, 502); }
}
