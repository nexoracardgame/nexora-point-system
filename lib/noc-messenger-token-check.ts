import { request as httpsRequest } from "node:https";

export const NOC_META_APP_ID = "2146587072887497";
export const NOC_META_API_VERSION = "v26.0";
export const NOC_META_FOAM_PAGES = ["408021709324004", "282598955251288"];
const SAFE_SCOPES = ["pages_messaging", "pages_manage_metadata", "pages_show_list", "pages_read_engagement"];

type TokenData = { is_valid?: unknown; app_id?: unknown; type?: unknown; profile_id?: unknown; expires_at?: unknown; data_access_expires_at?: unknown; scopes?: unknown; granular_scopes?: unknown };
export function validateNocPageToken(data: TokenData | null | undefined, pageId: string, now = Date.now()) {
  const type = ["PAGE", "USER", "APP", "SYSTEM_USER"].includes(String(data?.type)) ? String(data?.type) : "UNKNOWN";
  const scopes = Array.isArray(data?.scopes) ? data.scopes : [];
  const granted = SAFE_SCOPES.filter(scope => scopes.includes(scope));
  const fail = (reason: string) => ({ ok: false as const, reason, tokenType: type, granted });
  if (!data || data.is_valid !== true) return fail("TOKEN_INVALID");
  if (String(data.app_id || "") !== NOC_META_APP_ID) return fail("APP_MISMATCH");
  if (type !== "PAGE") return fail("TOKEN_TYPE");
  for (const expiry of [data.expires_at, data.data_access_expires_at]) {
    if (typeof expiry === "number" && expiry > 0 && expiry * 1000 <= now) return fail("TOKEN_EXPIRED");
  }
  if (!/^\d{5,30}$/.test(String(data.profile_id || ""))) return fail("PAGE_UNKNOWN");
  if (String(data.profile_id) !== pageId) return fail("PAGE_MISMATCH");
  if (!granted.includes("pages_messaging")) return fail("MISSING_MESSAGING");
  if (Array.isArray(data.granular_scopes)) {
    const scoped = data.granular_scopes.find((entry: { scope?: unknown }) => entry?.scope === "pages_messaging");
    if (scoped && Array.isArray(scoped.target_ids) && !scoped.target_ids.map(String).includes(pageId)) return fail("PAGE_SCOPE_MISMATCH");
  }
  return { ok: true as const, pageId, appId: NOC_META_APP_ID, apiVersion: NOC_META_API_VERSION, tokenType: type, granted };
}

export function inspectNocMetaToken(token: string, appSecret: string): Promise<{ status: number; body: { data?: TokenData; error?: { code?: unknown; error_subcode?: unknown } } }> {
  // Meta requires input_token in this GET query. Keep it out of Next fetch tracing and all application logs.
  return readNocMeta(`/${NOC_META_API_VERSION}/debug_token?input_token=${encodeURIComponent(token)}`, appSecret);
}

type SubscriptionBody = { data?: { object?: unknown; active?: unknown; callback_url?: unknown; fields?: unknown }[]; error?: { code?: unknown; error_subcode?: unknown } };
export function inspectNocMetaWebhooks(appSecret: string): Promise<{ status: number; body: SubscriptionBody }> {
  return readNocMeta(`/${NOC_META_API_VERSION}/${NOC_META_APP_ID}/subscriptions`, appSecret);
}

export function summarizeNocMetaWebhooks(body: SubscriptionBody) {
  if (!Array.isArray(body.data)) return { ok: false, reason: "META_FORMAT" };
  const callback = "https://nexora-point-system.vercel.app/api/noc-foam-messenger";
  const subscriptions = body.data.filter(entry => entry && entry.object === "page").map(entry => {
    const fields = Array.isArray(entry.fields) ? entry.fields : [];
    const names = fields.map(field => typeof field === "string" ? field : field?.name);
    return { active: entry.active === true, callbackMatches: entry.callback_url === callback,
      messages: names.includes("messages"), messageEchoes: names.includes("message_echoes") };
  });
  return { ok: true, appId: NOC_META_APP_ID, expectedCallback: callback, pageSubscriptions: subscriptions };
}

function readNocMeta<T>(path: string, appSecret: string): Promise<{ status: number; body: T }> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest({
      hostname: "graph.facebook.com", port: 443, method: "GET", signal: AbortSignal.timeout(12000),
      path,
      headers: { Authorization: `Bearer ${NOC_META_APP_ID}|${appSecret}`, Accept: "application/json" },
    }, response => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 65536) { req.destroy(new Error("Meta response too large")); return; }
        chunks.push(chunk);
      });
      response.on("error", () => reject(new Error("Meta inspection unavailable")));
      response.on("end", () => {
        try { resolve({ status: response.statusCode || 0, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }); }
        catch { reject(new Error("Meta inspection unavailable")); }
      });
    });
    req.setTimeout(12000, () => req.destroy(new Error("Meta inspection timeout")));
    req.on("error", () => reject(new Error("Meta inspection unavailable")));
    req.end();
  });
}
