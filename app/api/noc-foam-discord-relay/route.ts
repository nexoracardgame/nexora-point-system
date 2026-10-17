import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CHANNEL = "1171820203508764786";
const INTERACTIONS = "https://nexora-point-system.vercel.app/api/noc-foam-discord";
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  return json({ ok: true, service: "noc-foam-discord-relay", build: "signed-relay-v2" });
}

export async function POST(request: Request) {
  const secret = process.env.NOC_FOAM_WEBHOOK_SECRET;
  if (!secret) return json({ ok: false, error: "Relay not configured" }, 503);
  const timestamp = request.headers.get("x-noc-timestamp") || "";
  const signature = request.headers.get("x-noc-signature") || "";
  if (!/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 300000 || !/^[a-f0-9]{64}$/.test(signature)) return json({ ok: false }, 401);
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 24576) return json({ ok: false }, 413);
  const expected = createHmac("sha256", secret).update("noc-discord-relay-v1\n" + timestamp + "\n" + raw).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) return json({ ok: false }, 401);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ ok: false }, 400); }
  if (!body || typeof body !== "object") return json({ ok: false }, 400);
  const method = String(body.method || "GET");
  const path = String(body.path || "");
  const health = method === "GET" && path === "/gateway";
  const application = path === "/applications/@me";
  const allowed = health || (method === "GET" && (application || path === "/users/@me" || path === `/channels/${CHANNEL}`)) || (method === "PATCH" && application) || (method === "POST" && path === `/channels/${CHANNEL}/messages`);
  if (!allowed) return json({ ok: false, error: "Unsupported operation" }, 400);
  const token = String(body.botToken || "");
  if (!health && !/^[A-Za-z0-9._-]{40,250}$/.test(token)) return json({ ok: false, error: "Invalid token format" }, 400);
  if (method === "POST" && (!body.payload || typeof body.payload !== "object")) return json({ ok: false }, 400);
  if (method === "PATCH" && body.payload?.interactions_endpoint_url !== INTERACTIONS) return json({ ok: false, error: "Unsupported endpoint" }, 400);
  try {
    const headers: Record<string, string> = { "User-Agent": "DiscordBot (https://nexora-point-system.vercel.app, 1.0)", Accept: "application/json" };
    if (!health) headers.Authorization = "Bot " + token;
    if (method === "POST" || method === "PATCH") headers["Content-Type"] = "application/json";
    const payload = method === "PATCH" ? { interactions_endpoint_url: INTERACTIONS } : method === "POST" ? { ...body.payload, allowed_mentions: { parse: [] } } : undefined;
    const response = await fetch("https://discord.com/api/v10" + path, {
      method, headers, body: payload ? JSON.stringify(payload) : undefined,
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000)
    });
    let data;
    try { data = await response.json(); } catch { data = { message: "Discord returned a non-JSON response" }; }
    // Only necessary identity/channel fields cross back; never echo credentials or request headers.
    if (health && response.ok) data = { reachable: true };
    else if (application && response.ok) data = { id: data.id, owner_id: data.owner?.id || data.team?.owner_user_id, interactions_endpoint_url: data.interactions_endpoint_url || "" };
    else if (response.ok && method === "GET" && path === "/users/@me") data = { id: data.id, bot: data.bot };
    else if (response.ok && method === "GET") data = { id: data.id, guild_id: data.guild_id, type: data.type };
    else if (response.ok) data = { id: data.id };
    else data = { code: Number.isInteger(data?.code) ? data.code : 0, retry_after: typeof data?.retry_after === "number" ? data.retry_after : undefined };
    return json({ ok: true, status: response.status, data });
  } catch { return json({ ok: false, error: "Discord connection unavailable" }, 502); }
}
