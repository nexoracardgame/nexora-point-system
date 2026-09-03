import { createHash, createHmac, randomBytes } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const ALLOWED_ACTIONS = new Set([
  "assign-role",
  "bot",
  "guild",
  "guild-list",
  "oauth-complete",
  "proxy-diagnostics",
  "roles",
  "server-status",
]);

const MC_DISCORD_CLIENT_ID = "1544896499241062541";
const MC_DISCORD_GUILD_ID = "1525555571502350528";
const MC_DISCORD_INVITE_URL = "https://discord.gg/n5SDytjHVw";
const PRIMARY_CFX_STATUS_URL = "https://frontend.cfx-services.net/api/servers/single/vq3dge5";
const PRIMARY_FIVEM_ENDPOINTS = ["play.aroundtown-rp.com:30120", "play.aroundtown-rp.com"];
const SECONDARY_FIVEM_ENDPOINTS = ["play.mhnk.online:30120", "play.mhnk.online"];

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Headers": "content-type,x-mc-discord-proxy-secret",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Headers": "content-type,x-mc-discord-proxy-secret",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

function cleanSnowflake(value: unknown) {
  return String(value || "").replace(/[^\d]/g, "").slice(0, 32);
}

function cleanOAuthCode(value: unknown) {
  return String(value || "").trim().slice(0, 512);
}

function cleanText(value: unknown, maxLength = 120) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

async function readDiscordJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text.slice(0, 300) };
  }
}

function resolveDiscordPath(action: string, body: Record<string, unknown>) {
  const guildId = cleanSnowflake(body.guildId);
  const userId = cleanSnowflake(body.userId);
  const roleId = cleanSnowflake(body.roleId);

  if (action === "bot") return { ok: true, method: "GET", path: "/users/@me" };
  if (action === "guild-list") return { ok: true, method: "GET", path: "/users/@me/guilds" };
  if ((action === "guild" || action === "roles") && !guildId) {
    return { ok: false, message: "Missing guildId" };
  }
  if (action === "guild") return { ok: true, method: "GET", path: `/guilds/${guildId}` };
  if (action === "roles") return { ok: true, method: "GET", path: `/guilds/${guildId}/roles` };
  if (action === "assign-role") {
    if (!guildId || !userId || !roleId) {
      return { ok: false, message: "Missing guildId, userId, or roleId" };
    }
    return {
      ok: true,
      method: "PUT",
      path: `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    };
  }

  return { ok: false, message: "Unsupported action" };
}

function canonicalDiscordProof(data: {
  expiresAt: number;
  globalName: string;
  joinStatus: string;
  linkedAt: string;
  linkToken: string;
  userId: string;
  username: string;
}) {
  return [
    data.linkToken,
    data.userId,
    data.username,
    data.globalName,
    data.linkedAt,
    data.joinStatus,
    String(data.expiresAt),
  ].join("\n");
}

function signDiscordProof(secret: string, proof: ReturnType<typeof buildDiscordProof>) {
  return createHmac("sha256", secret).update(canonicalDiscordProof(proof)).digest("hex");
}

function fingerprintSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex").slice(0, 12);
}

function buildDiscordProof(input: {
  globalName: string;
  joinStatus: string;
  userId: string;
  username: string;
}) {
  return {
    linkToken: randomBytes(16).toString("hex"),
    userId: input.userId,
    username: input.username,
    globalName: input.globalName,
    linkedAt: new Date().toISOString(),
    joinStatus: input.joinStatus,
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
  };
}

function formatDiscordUsername(user: Record<string, unknown>) {
  const globalName = cleanText(user.global_name);
  const username = cleanText(user.username);
  const discriminator = cleanText(user.discriminator, 16);
  if (globalName && username) return `${globalName} (@${username})`.slice(0, 120);
  if (username && discriminator && discriminator !== "0") return `${username}#${discriminator}`.slice(0, 120);
  return (username || globalName || "Discord User").slice(0, 120);
}

async function completeDiscordOAuth(body: Record<string, unknown>, proxySecret: string) {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim() || MC_DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
  const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
  const guildId = cleanSnowflake(process.env.DISCORD_GUILD_ID || body.guildId) || MC_DISCORD_GUILD_ID;
  const code = cleanOAuthCode(body.code);
  const redirectUri = cleanText(body.redirectUri, 500);

  if (!clientSecret) return { ok: false, message: "Discord client secret is not configured on Vercel" };
  if (!botToken) return { ok: false, message: "Discord bot token is not configured on Vercel" };
  if (!code || !/^https:\/\/script\.google\.com\/macros\/s\/[^/?#]+\/exec$/i.test(redirectUri)) {
    return { ok: false, message: "Invalid Discord OAuth callback" };
  }

  const tokenResponse = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  const tokenJson = (await readDiscordJson(tokenResponse)) as Record<string, unknown>;
  const accessToken = cleanText(tokenJson.access_token, 512);
  if (!tokenResponse.ok || !accessToken) {
    return {
      ok: false,
      message: `เชื่อม Discord ไม่สำเร็จ: ${cleanText(tokenJson.error_description || tokenJson.error || tokenJson.message || tokenResponse.status, 160)}`,
    };
  }

  const userResponse = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const userJson = (await readDiscordJson(userResponse)) as Record<string, unknown>;
  const userId = cleanSnowflake(userJson.id);
  if (!userResponse.ok || !userId) {
    return { ok: false, message: `อ่านโปรไฟล์ Discord ไม่สำเร็จ: ${cleanText(userJson.message || userResponse.status, 160)}` };
  }

  const joinResponse = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "DiscordBot (THE MC CLUB VERIFY Proxy; 1.1)",
    },
    body: JSON.stringify({ access_token: accessToken }),
    cache: "no-store",
  });
  const joinJson = (await readDiscordJson(joinResponse)) as Record<string, unknown>;
  const joinOk = joinResponse.ok || joinResponse.status === 204;
  const joinStatus = joinOk
    ? "เข้า Discord server แล้ว"
    : `เชื่อม Discord แล้ว แต่ยังจอยเซิร์ฟไม่ได้: ${cleanText(joinJson.message || joinResponse.status, 120)}`;

  const proof = buildDiscordProof({
    userId,
    username: formatDiscordUsername(userJson),
    globalName: cleanText(userJson.global_name),
    joinStatus,
  });
  const signature = signDiscordProof(proxySecret, proof);

  return {
    ok: true,
    linkToken: proof.linkToken,
    joinOk,
    inviteUrl: MC_DISCORD_INVITE_URL,
    proof,
    proxySecretFingerprint: fingerprintSecret(proxySecret),
    signature,
    user: {
      id: proof.userId,
      username: proof.username,
      globalName: proof.globalName,
    },
    message: joinOk
      ? "เชื่อมต่อ Discord และพาเข้าเซิร์ฟเวอร์แล้ว"
      : "เชื่อมต่อ Discord สำเร็จแล้ว กำลังเปิดคำเชิญเข้าเซิร์ฟเวอร์",
  };
}

function buildFiveMStatus(
  online: boolean,
  data: Record<string, unknown> | null,
  endpoint: string,
  source: string,
  error = "",
) {
  const vars = data && typeof data.vars === "object" && data.vars ? data.vars as Record<string, unknown> : {};
  const clients = Number(data && (data.clients || data.selfReportedClients || 0));
  const maxClients = Number(data && (data.sv_maxclients || data.svMaxclients || vars.sv_maxClients || vars.sv_maxclients || 0));
  return {
    ok: true,
    online,
    endpoint,
    source,
    hostname: cleanText(data && (data.hostname || vars.sv_projectName), 160),
    clients: Number.isFinite(clients) ? clients : 0,
    maxClients: Number.isFinite(maxClients) ? maxClients : 0,
    checkedAt: new Date().toISOString(),
    error,
  };
}

function buildFiveMUnknown(endpoint: string, error: string) {
  return {
    ok: false,
    online: false,
    endpoint,
    source: "unreachable",
    hostname: "",
    clients: 0,
    maxClients: 0,
    checkedAt: new Date().toISOString(),
    error: cleanText(error, 500),
  };
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 3500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        "User-Agent": "THE-MC-CLUB-Status-Proxy/1.0",
      },
      signal: controller.signal,
    });
    const json = (await readDiscordJson(response)) as Record<string, unknown>;
    return { ok: response.ok, status: response.status, json };
  } finally {
    clearTimeout(timeout);
  }
}

async function getFiveMStatus(body: Record<string, unknown>) {
  const kind = cleanText(body.kind, 20) === "secondary" ? "secondary" : "primary";
  const errors: string[] = [];

  if (kind === "primary") {
    try {
      const cfx = await fetchJsonWithTimeout(`${PRIMARY_CFX_STATUS_URL}?t=${Date.now()}`, 3200);
      if (cfx.status === 404) return buildFiveMStatus(false, null, "vq3dge5", "cfx-frontend");
      if (cfx.ok) {
        const data = cfx.json && cfx.json.Data && typeof cfx.json.Data === "object"
          ? cfx.json.Data as Record<string, unknown>
          : cfx.json;
        if (data) return buildFiveMStatus(true, data, cleanText(cfx.json.EndPoint, 80) || "vq3dge5", "cfx-frontend");
      }
      errors.push(`cfx ${cfx.status}`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "cfx failed");
    }
  }

  const endpoints = kind === "secondary" ? SECONDARY_FIVEM_ENDPOINTS : PRIMARY_FIVEM_ENDPOINTS;
  for (const endpoint of endpoints) {
    try {
      const dynamic = await fetchJsonWithTimeout(`http://${endpoint}/dynamic.json?t=${Date.now()}`, 2500);
      if (dynamic.ok) return buildFiveMStatus(true, dynamic.json, endpoint, "dynamic.json");
      errors.push(`${endpoint}/dynamic ${dynamic.status}`);
    } catch (error) {
      errors.push(`${endpoint}/dynamic ${error instanceof Error ? error.message : "failed"}`);
    }

    try {
      const players = await fetchJsonWithTimeout(`http://${endpoint}/players.json?t=${Date.now()}`, 2500);
      if (players.ok && Array.isArray(players.json)) {
        return buildFiveMStatus(true, { clients: players.json.length }, endpoint, "players.json");
      }
      errors.push(`${endpoint}/players ${players.status}`);
    } catch (error) {
      errors.push(`${endpoint}/players ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  return buildFiveMUnknown(endpoints[0], errors.join(" | "));
}

export async function POST(request: Request) {
  const expectedSecret = process.env.MC_DISCORD_PROXY_SECRET?.trim();
  if (!expectedSecret) {
    return jsonResponse({ ok: false, message: "Proxy secret is not configured" }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, message: "Invalid JSON" }, 400);
  }

  const action = String(body.action || "").trim();
  if (!ALLOWED_ACTIONS.has(action)) {
    return jsonResponse({ ok: false, message: "Unsupported action" }, 400);
  }

  if (action === "oauth-complete") {
    try {
      return jsonResponse(await completeDiscordOAuth(body, expectedSecret));
    } catch (error) {
      return jsonResponse({
        ok: false,
        message: error instanceof Error ? error.message : "Discord OAuth proxy failed",
      });
    }
  }

  if (action === "proxy-diagnostics") {
    return jsonResponse({
      ok: true,
      proxySecretFingerprint: fingerprintSecret(expectedSecret),
      proxySecretLength: expectedSecret.length,
      checkedAt: new Date().toISOString(),
    });
  }

  if (action === "server-status") {
    try {
      return jsonResponse(await getFiveMStatus(body));
    } catch (error) {
      return jsonResponse(buildFiveMUnknown("proxy", error instanceof Error ? error.message : "status proxy failed"));
    }
  }

  const incomingSecret = request.headers.get("x-mc-discord-proxy-secret")?.trim();
  if (incomingSecret !== expectedSecret) {
    return jsonResponse({ ok: false, message: "Invalid proxy secret" }, 401);
  }

  const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!botToken) return jsonResponse({ ok: false, message: "Discord bot token is not configured" }, 500);

  const resolved = resolveDiscordPath(action, body);
  if (!resolved.ok) return jsonResponse(resolved, 400);

  try {
    const discordResponse = await fetch(`${DISCORD_API_BASE}${resolved.path}`, {
      method: resolved.method,
      headers: {
        Authorization: `Bot ${botToken}`,
        Accept: "application/json",
        "User-Agent": "DiscordBot (THE MC CLUB VERIFY Proxy; 1.0)",
      },
      cache: "no-store",
    });
    const json = await readDiscordJson(discordResponse);
    return jsonResponse({
      ok: discordResponse.ok,
      status: discordResponse.status,
      json,
    }, discordResponse.ok ? 200 : 200);
  } catch (error) {
    return jsonResponse({
      ok: false,
      status: 0,
      json: {},
      message: error instanceof Error ? error.message : "network error",
    }, 200);
  }
}
