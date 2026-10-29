import { createHash, createHmac, randomBytes } from "crypto";
import { readApprovalHistory } from './approval-history';
import { sendEventNotification } from './events';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DISCORD_API_BASE = "https://discord.com/api/v10";
const MC_DISCORD_PROXY_BUILD = "member-discord-login-v5";
const DISCORD_ROSTER_RETRY_LIMIT = 3;
const ALLOWED_ACTIONS = new Set([
  "assign-role",
  "set-nickname",
  "bot",
  "guild",
  "guild-list",
  "oauth-complete",
  "oauth-login",
  "proxy-diagnostics",
  "roles",
  "server-status",
  "sync-roster-message",
  "prepare-roster-emojis",
  "approval-history",
  "event-notify",
]);

const ROSTER_EMOJI_SOURCES = [
  { id: "1297923558420516914", name: "mc_roster_badge", animated: true },
  { id: "1536736424638812190", name: "mc_roster_at", animated: false },
  { id: "1506879092094537830", name: "mc_roster_mhnk", animated: false },
  { id: "1506940284205010964", name: "mc_roster_title", animated: true },
  { id: "1200056999052857354", name: "mc_roster_updated", animated: true },
  { id: "1495409128745734144", name: "mc_roster_page", animated: true },
  { id: "wv-blue-heart-spin", name: "2750blueheartspin", animated: true, imageUrl: "https://cdn3.emoji.gg/emojis/2750-blue-heart-spin.gif" },
];

async function rosterEmojiApi(path: string, botToken: string, payload?: Record<string, unknown>) {
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    method: payload ? "POST" : "GET",
    headers: { ...getDiscordBotHeaders(botToken), ...(payload ? { "Content-Type": "application/json" } : {}) },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    cache: "no-store",
  });
  const json = await readDiscordJson(response) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Discord application emoji request failed [HTTP ${response.status}]`);
  return json;
}

async function getRosterApplicationEmojis(botToken: string, createMissing = false) {
  const app = await rosterEmojiApi("/oauth2/applications/@me", botToken);
  const appId = cleanSnowflake(app.id);
  if (!appId) throw new Error("Discord bot application could not be identified");
  const path = `/applications/${appId}/emojis`;
  const list = await rosterEmojiApi(path, botToken);
  if (!Array.isArray(list.items)) throw new Error("Invalid Discord application emoji response");
  const emojis = list.items as Array<Record<string, unknown>>;
  const replacements: Record<string, string> = {};
  for (const source of ROSTER_EMOJI_SOURCES) {
    let emoji = emojis.find(item => item.name === source.name && cleanSnowflake(item.id));
    if (!emoji && createMissing) {
      // Only copy the configured user-selected public assets, never a caller-supplied URL.
      const extension = source.animated ? "gif" : "png";
      const image = await fetch(source.imageUrl || `https://cdn.discordapp.com/emojis/${source.id}.${extension}?size=128&quality=lossless`, { redirect: "error" });
      const mime = image.headers.get("content-type")?.split(";")[0];
      if (!image.ok || mime !== `image/${extension}`) throw new Error(`Could not load roster emoji ${source.name}`);
      const bytes = Buffer.from(await image.arrayBuffer());
      if (!bytes.length || bytes.length > 256 * 1024) throw new Error(`Roster emoji ${source.name} exceeds Discord's upload limit`);
      emoji = await rosterEmojiApi(path, botToken, { name: source.name, image: `data:${mime};base64,${bytes.toString("base64")}` });
    }
    if (!emoji && source.id === 'wv-blue-heart-spin' && !createMissing) continue;
    if (!emoji || !cleanSnowflake(emoji.id) || emoji.available === false || Boolean(emoji.animated) !== source.animated) {
      throw new Error(`Prepare application emoji ${source.name} before syncing the roster`);
    }
    replacements[source.id] = `<${emoji.animated ? "a" : ""}:${source.name}:${emoji.id}>`;
  }
  return replacements;
}

function replaceRosterEmojis(content: string, replacements: Record<string, string>) {
  return content.replace(/<a?:[^:>]+:(\d+)>/g, (token, id: string) => replacements[id] || token);
}

const MC_DISCORD_CLIENT_ID = "1544896499241062541";
const MC_DISCORD_GUILD_ID = "1525555571502350528";
const MC_DISCORD_INVITE_URL = "https://discord.gg/n5SDytjHVw";
const PRIMARY_CFX_STATUS_URL = "https://frontend.cfx-services.net/api/servers/single/vq3dge5";
const PRIMARY_FIVEM_ENDPOINTS = ["play.aroundtown-rp.com:30120", "play.aroundtown-rp.com"];
const SECONDARY_FIVEM_ENDPOINTS = ["play.mhnk.online:30120", "play.mhnk.online"];
const WAVEVY_FIVEM_ENDPOINTS = ["play.wavevycity.com:30120", "play.wavevycity.com"];

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

function cleanDiscordMessageContent(value: unknown) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").slice(0, 2000);
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
  if (action === "set-nickname") {
    if (!guildId || !userId) return { ok: false, message: "Missing guildId or userId" };
    if (typeof body.nickname !== "string" || !body.nickname.trim() || Array.from(body.nickname).length > 32) {
      return { ok: false, message: "Nickname must contain 1 to 32 characters" };
    }
    return {
      ok: true,
      method: "PATCH",
      path: `/guilds/${guildId}/members/${userId}`,
      payload: { nick: body.nickname },
    };
  }

  return { ok: false, message: "Unsupported action" };
}

function canonicalDiscordProof(data: {
  expiresAt: number;
  linkToken: string;
  userId: string;
}) {
  return [
    data.linkToken,
    data.userId,
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

async function completeDiscordOAuth(body: Record<string, unknown>, proxySecret: string, loginOnly = false) {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim() || MC_DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
  const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
  const guildId = cleanSnowflake(process.env.DISCORD_GUILD_ID || body.guildId) || MC_DISCORD_GUILD_ID;
  const code = cleanOAuthCode(body.code);
  const redirectUri = cleanText(body.redirectUri, 500);

  if (!clientSecret) return { ok: false, message: "Discord client secret is not configured on Vercel" };
  if (!loginOnly && !botToken) return { ok: false, message: "Discord bot token is not configured on Vercel" };
  const hostedLoginCallback = loginOnly && redirectUri === "https://nexora-point-system.vercel.app/api/mc-discord/login";
  if (!code || (!hostedLoginCallback && !/^https:\/\/script\.google\.com\/macros\/s\/[^/?#]+\/exec$/i.test(redirectUri))) {
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

  // Login only verifies identity; it never joins a guild or changes roles.
  if (loginOnly) return { ok: true, userId };

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
  const requestedKind = cleanText(body.kind, 20);
  const kind = requestedKind === "wavevy" ? "wavevy" : requestedKind === "secondary" ? "secondary" : "primary";
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

  const endpoints = kind === "wavevy" ? WAVEVY_FIVEM_ENDPOINTS : kind === "secondary" ? SECONDARY_FIVEM_ENDPOINTS : PRIMARY_FIVEM_ENDPOINTS;
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

type RosterMessageCandidate = {
  id: string;
  key: string;
  content: string;
  editable: boolean;
};

function getDiscordBotHeaders(botToken: string, json = false) {
  return {
    Authorization: `Bot ${botToken}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
    Accept: "application/json",
    "User-Agent": "DiscordBot (THE MC CLUB Roster Sync; 1.0)",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDiscordRetryAfterMs(response: Response, json: Record<string, unknown>) {
  const bodyRetryAfter = Number(json.retry_after);
  if (Number.isFinite(bodyRetryAfter) && bodyRetryAfter > 0) {
    return Math.ceil((bodyRetryAfter < 100 ? bodyRetryAfter * 1000 : bodyRetryAfter) + 150);
  }
  const headerRetryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(headerRetryAfter) && headerRetryAfter > 0) {
    return Math.ceil((headerRetryAfter < 100 ? headerRetryAfter * 1000 : headerRetryAfter) + 150);
  }
  return 1150;
}

function getRosterMessageKey(content: string) {
  const markerMatch = content.match(/\bROSTER KEY\s+(roster-[a-z0-9-]+)\b/i);
  if (markerMatch) return markerMatch[1].toLowerCase();
  const header = content.split("\n").slice(0, 3).join("\n");
  const rangeMatch = header.match(/THE MC CLUB \| MEMBERS (\d{3}-\d{3})/);
  const partMatch = header.match(/PAGE · หน้า (\d+)\/(\d+)/);
  if (rangeMatch && partMatch) {
    const part = Number(partMatch[1]);
    const total = Number(partMatch[2]);
    if (part > 0 && part <= total) return `roster-${rangeMatch[1]}${part === 1 ? "" : `-part-${part}`}`;
    return "";
  }
  if (rangeMatch && /MEMBERS · สมาชิก \d+/.test(header)) return `roster-${rangeMatch[1]}`;
  const pageMatch = content.match(/\bPAGE\s+(\d+)\s*\/\s*\d+\b/i);
  if (!pageMatch) return "";
  const page = Number(pageMatch[1]);
  return Number.isFinite(page) && page > 0 ? `roster-${page}` : "";
}

async function readRosterDiscordApi(path: string, botToken: string) {
  for (let attempt = 0; attempt <= DISCORD_ROSTER_RETRY_LIMIT; attempt += 1) {
    const response = await fetch(`${DISCORD_API_BASE}${path}`, {
      method: "GET", headers: getDiscordBotHeaders(botToken), cache: "no-store",
    });
    const json = await readDiscordJson(response);
    if (response.status === 429 && attempt < DISCORD_ROSTER_RETRY_LIMIT) {
      await sleep(getDiscordRetryAfterMs(response, json as Record<string, unknown>));
      continue;
    }
    if (!response.ok) throw new Error(`Cannot read Discord roster [HTTP ${response.status}]; no new pages will be created`);
    return json;
  }
  throw new Error("Discord roster history retry limit reached");
}

function getRosterCandidate(raw: Record<string, unknown>, botId: string): RosterMessageCandidate | null {
  const author = raw.author && typeof raw.author === "object" ? raw.author as Record<string, unknown> : {};
  if (author.bot !== true) return null;
  const embeds = Array.isArray(raw.embeds) ? raw.embeds as Array<Record<string, unknown>> : [];
  const content = [String(raw.content || ""), ...embeds.map(embed =>
    [embed.title, embed.description, (embed.footer as Record<string, unknown> | undefined)?.text].filter(Boolean).join("\n")
  )].filter(Boolean).join("\n");
  const header = content.split("\n").slice(0, 5).join("\n");
  if (!/\bTHE MC CLUB (?:MEMBER ROSTER|\| MEMBERS)\b/.test(header)) return null;
  const id = cleanSnowflake(raw.id);
  if (!id) return null;
  return { id, key: getRosterMessageKey(content), content, editable: String(author.id) === botId && !raw.webhook_id };
}

async function fetchRecentRosterCandidates(channelId: string, botToken: string, maxMessages = 5000) {
  const bot = await readRosterDiscordApi('/users/@me', botToken) as Record<string, unknown>;
  const botId = cleanSnowflake(bot.id);
  if (!botId) throw new Error("Cannot identify the roster bot");
  const candidates: RosterMessageCandidate[] = [];
  let before = "";
  let scanned = 0;

  while (scanned < maxMessages) {
    const url = new URL(`${DISCORD_API_BASE}/channels/${channelId}/messages`);
    url.searchParams.set("limit", String(Math.min(100, maxMessages - scanned)));
    if (before) url.searchParams.set("before", before);

    const json = await readRosterDiscordApi(url.toString().slice(DISCORD_API_BASE.length), botToken);
    if (!Array.isArray(json)) throw new Error("Invalid roster history response");
    if (!json.length) return candidates;
    scanned += json.length;

    for (const item of json) {
      const raw = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const candidate = getRosterCandidate(raw, botId);
      if (candidate) candidates.push(candidate);
    }

    const last = json[json.length - 1];
    const rawLast = last && typeof last === "object" ? last as Record<string, unknown> : {};
    const next = cleanSnowflake(rawLast.id);
    if (!next || next === before) throw new Error("Invalid roster history cursor");
    before = next;
    if (json.length < 100) return candidates;
  }
  throw new Error("Roster history exceeds the scan limit; refusing an incomplete reconciliation");
}

type RosterPayload = { content: string; embeds: Array<{ description: string; color: number }> };

async function patchRosterMessage(channelId: string, messageId: string, content: string, botToken: string, payload?: RosterPayload) {
  for (let attempt = 0; attempt <= DISCORD_ROSTER_RETRY_LIMIT; attempt += 1) {
    const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`, {
      method: "PATCH",
      headers: getDiscordBotHeaders(botToken, true),
      body: JSON.stringify({ ...(payload || { content, embeds: [] }), allowed_mentions: { parse: [] } }),
      cache: "no-store",
    });
    const json = (await readDiscordJson(response)) as Record<string, unknown>;
    if (response.status === 429 && attempt < DISCORD_ROSTER_RETRY_LIMIT) {
      await sleep(getDiscordRetryAfterMs(response, json));
      continue;
    }
    return { ok: response.ok, status: response.status, json };
  }
  return { ok: false, status: 429, json: { message: "Discord roster patch retry limit reached" } };
}

async function createRosterMessage(channelId: string, content: string, botToken: string, key = "", payload?: RosterPayload) {
  const nonce = createHash("sha256").update(`${channelId}:${key}:${content}`).digest("hex").slice(0, 24);
  for (let attempt = 0; attempt <= DISCORD_ROSTER_RETRY_LIMIT; attempt += 1) {
    const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
      method: "POST",
      headers: getDiscordBotHeaders(botToken, true),
      body: JSON.stringify({ ...(payload || { content, embeds: [] }), nonce, enforce_nonce: true, allowed_mentions: { parse: [] } }),
      cache: "no-store",
    });
    const json = (await readDiscordJson(response)) as Record<string, unknown>;
    if (response.status === 429 && attempt < DISCORD_ROSTER_RETRY_LIMIT) {
      await sleep(getDiscordRetryAfterMs(response, json));
      continue;
    }
    return { ok: response.ok, status: response.status, json };
  }
  return { ok: false, status: 429, json: { message: "Discord roster create retry limit reached" } };
}

async function deleteRosterMessage(channelId: string, messageId: string, botToken: string) {
  for (let attempt = 0; attempt <= DISCORD_ROSTER_RETRY_LIMIT; attempt += 1) {
    const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`, {
      method: "DELETE",
      headers: getDiscordBotHeaders(botToken),
      cache: "no-store",
    });
    if (response.status === 404) return true;
    if (response.status !== 429) return response.ok || response.status === 204;
    const json = (await readDiscordJson(response)) as Record<string, unknown>;
    if (attempt < DISCORD_ROSTER_RETRY_LIMIT) {
      await sleep(getDiscordRetryAfterMs(response, json));
    }
  }
  return false;
}

async function bulkDeleteRosterMessages(channelId: string, messageIds: string[], botToken: string) {
  const ids = Array.from(new Set(messageIds.map(cleanSnowflake).filter(Boolean)));
  let deleted = 0;

  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    if (chunk.length === 1) {
      if (await deleteRosterMessage(channelId, chunk[0], botToken)) deleted += 1;
      continue;
    }

    let bulkDeleted = false;
    for (let attempt = 0; attempt <= DISCORD_ROSTER_RETRY_LIMIT; attempt += 1) {
      const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages/bulk-delete`, {
        method: "POST",
        headers: getDiscordBotHeaders(botToken, true),
        body: JSON.stringify({ messages: chunk }),
        cache: "no-store",
      });

      if (response.ok || response.status === 204) {
        deleted += chunk.length;
        bulkDeleted = true;
        break;
      }
      if (response.status !== 429) break;
      const json = (await readDiscordJson(response)) as Record<string, unknown>;
      if (attempt < DISCORD_ROSTER_RETRY_LIMIT) {
        await sleep(getDiscordRetryAfterMs(response, json));
      }
    }

    if (bulkDeleted) continue;

    for (const messageId of chunk) {
      if (await deleteRosterMessage(channelId, messageId, botToken)) deleted += 1;
    }
  }

  return deleted;
}

function compareRosterKeys(left: string, right: string) {
  const a = left.match(/^roster-(\d{3})-(\d{3})(?:-part-(\d+))?$/)!;
  const b = right.match(/^roster-(\d{3})-(\d{3})(?:-part-(\d+))?$/)!;
  return Number(a[1]) - Number(b[1]) || Number(a[2]) - Number(b[2]) || Number(a[3] || 1) - Number(b[3] || 1);
}

function compareRosterMessageIds(left: { id: string }, right: { id: string }) {
  const a = BigInt(left.id), b = BigInt(right.id);
  return a < b ? -1 : a > b ? 1 : 0;
}

function stableRosterContent(value: string) {
  return value.replace(/(UPDATED · อัปเดต) [^\n]+/g, '$1').replace(/\n{2,}/g, '\n').trim();
}

function combineRosterRanges(pages: Array<Record<string, unknown>>) {
  const groups = new Map<string, { key: string; header: string[]; lines: string[] }>();
  for (const page of [...pages].sort((a, b) => compareRosterKeys(String(a.key), String(b.key)))) {
    const key = String(page.key).replace(/-part-\d+$/, '');
    const parts = String(page.content).replace(/\r\n?/g, '\n').split('\n');
    const group = groups.get(key) || { key, header: parts.slice(0, 3), lines: [] };
    group.lines.push(...parts.slice(3).filter(line => line.trim()));
    groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    const icon = group.header[2]?.match(/^<a?:[^>]+> /)?.[0] || '';
    group.header[2] = `${icon}MEMBERS · สมาชิก ${group.lines.length}`;
    return { key: group.key, content: [...group.header, '', ...group.lines].join('\n') };
  });
}

function buildRosterPayload(text: string): RosterPayload {
  const lines = text.split('\n');
  const header = lines.slice(0, 3).join('\n');
  const memberLines = lines.slice(3).filter(line => line.trim());
  // Content and embeds belong to one Discord message. Never split a member row.
  const pack = (rows: string[]): RosterPayload | null => {
    let content = header;
    const rest = [...rows];
    while (rest.join('\n').length > 6000 && rest.length) {
      const next = `${content}\n${rest.shift()}`;
      if (next.length > 2000) return null;
      content = next;
    }
    if (content.length > 2000) return null;
    const embeds: RosterPayload['embeds'] = [];
    let description = '';
    for (const line of rest) {
      if (line.length > 4096) return null;
      if (description && description.length + 1 + line.length > 4096) {
        embeds.push({ description, color: 0xa66cff });
        description = '';
      }
      description += `${description ? '\n' : ''}${line}`;
    }
    if (description) embeds.push({ description, color: 0xa66cff });
    if (embeds.length > 10 || embeds.reduce((n, item) => n + item.description.length, 0) > 6000) return null;
    return { content, embeds };
  };
  const payload = pack(memberLines);
  if (payload) return payload;
  // Dense dual-country ranges retain every value and emoji; only delimiters are tightened.
  const compact = memberLines.map(line => line
    .replace(/^(<a?:[^>]+>) \[(\d{3})\] /, '$1$2 ')
    .replace(/> (?=\d)/g, '>').replace(/ \/ /g, '/').replace(/ ([♂♀⚧-])$/, '$1'));
  const compactPayload = pack(compact);
  if (!compactPayload) throw new Error('Roster range exceeds one message capacity; no member data was truncated');
  return compactPayload;
}

function flattenRosterPayload(payload: RosterPayload) {
  return [payload.content, ...payload.embeds.map(embed => embed.description)].filter(Boolean).join('\n');
}

async function syncRosterMessages(body: Record<string, unknown>, botToken: string) {
  const channelId = cleanSnowflake(body.channelId);
  if (!channelId) return { ok: false, message: "Missing roster channelId" };
  if (!Array.isArray(body.messages)) return { ok: false, message: "Missing roster messages" };
  const rawMessages = body.messages;
  if (rawMessages.length > 40 || rawMessages.some((raw) =>
    !raw || typeof raw !== "object" || typeof raw.content !== "string" || raw.content.length > 10000
  )) return { ok: false, message: "Invalid roster input size" };
  const keys = rawMessages.map(raw => raw.key);
  if (new Set(keys).size !== keys.length || keys.some(key => typeof key !== "string" || !/^roster-\d{3}-\d{3}(?:-part-(?:[2-9]|[1-9]\d+))?$/.test(key))) {
    return { ok: false, message: "Invalid or duplicate roster page keys" };
  }
  const ranges = new Set(['roster-000-050', 'roster-051-100', 'roster-101-150', 'roster-151-200', 'roster-201-250', 'roster-251-300']);
  if (keys.some(key => !ranges.has(key.replace(/-part-\d+$/, '')))) return { ok: false, message: 'Invalid roster number range' };

  const usesRosterEmojis = rawMessages.some(raw => ROSTER_EMOJI_SOURCES.some(source => raw.content.includes(`:${source.id}>`)));
  const emojiMap = usesRosterEmojis ? await getRosterApplicationEmojis(botToken) : {};
  const preparedMessages = combineRosterRanges(rawMessages).map(raw => {
    const payload = buildRosterPayload(replaceRosterEmojis(raw.content, emojiMap));
    return { ...raw, payload, content: flattenRosterPayload(payload) };
  });

  const recentCandidates = await fetchRecentRosterCandidates(channelId, botToken);
  // Editing a Discord message cannot move it. Assign ordered pages to chronological slots,
  // regardless of the page key previously stored at each slot.
  const slots = recentCandidates.filter(candidate => candidate.editable !== false).sort(compareRosterMessageIds);

  const results: Array<{
    key: string;
    ok: boolean;
    messageId: string;
    status: number;
    mode: "created" | "updated" | "unchanged" | "failed";
    error?: unknown;
  }> = [];

  for (let index = 0; index < preparedMessages.length; index += 1) {
    const raw = preparedMessages[index];
    const key = raw.key;
    const content = raw.content;
    if (!content) {
      results.push({ key, ok: false, messageId: '', status: 400, mode: "failed", error: "empty content" });
      continue;
    }

    let updated = false;
    let blockedByPatchFailure = false;
    const candidate = slots[index];
    if (candidate && stableRosterContent(candidate.content) === stableRosterContent(content)) {
      results.push({ key, ok: true, messageId: candidate.id, status: 200, mode: "unchanged" });
      continue;
    }
    const messageIdCandidates = [candidate?.id]
      .filter((value): value is string => Boolean(value))
      .filter((value, itemIndex, list) => list.indexOf(value) === itemIndex);

    for (const messageId of messageIdCandidates) {
      const patchResponse = await patchRosterMessage(channelId, messageId, content, botToken, raw.payload);
      if (patchResponse.ok) {
        results.push({
          key,
          ok: true,
          messageId: cleanSnowflake(patchResponse.json.id) || messageId,
          status: patchResponse.status,
          mode: "updated",
        });
        updated = true;
        break;
      }
      // If a slot disappeared mid-sync, retry from a fresh history snapshot instead of
      // appending an early page after all later pages.
      if (!patchResponse.ok) {
        results.push({
          key,
          ok: false,
          messageId,
          status: patchResponse.status,
          mode: "failed",
          error: patchResponse.json,
        });
        blockedByPatchFailure = true;
        break;
      }
    }

    if (blockedByPatchFailure) break;

    if (!updated) {
      const createResponse = await createRosterMessage(channelId, content, botToken, key, raw.payload);
      const createdId = cleanSnowflake(createResponse.json.id);
      results.push({
        key,
        ok: createResponse.ok && Boolean(createdId),
        messageId: createdId,
        status: createResponse.status,
        mode: createResponse.ok ? "created" : "failed",
        error: createResponse.ok ? undefined : createResponse.json,
      });
    }
  }

  const failed = results.filter((item) => !item.ok);
  let deleted = 0;
  let remaining = 0;
  let missing = 0;
  let order: string[] = [];
  let orderMismatch = false;
  if (!failed.length) {
    const activeIds = new Set(results.map((item) => item.messageId).filter(Boolean));
    const staleIds = new Set<string>();
    recentCandidates.forEach((candidate) => {
      if (!activeIds.has(candidate.id)) staleIds.add(candidate.id);
    });
    deleted = await bulkDeleteRosterMessages(channelId, Array.from(staleIds), botToken);
    const verified = await fetchRecentRosterCandidates(channelId, botToken);
    remaining = verified.filter(item => !activeIds.has(item.id)).length;
    const verifiedIds = new Set(verified.map(item => item.id));
    missing = [...activeIds].filter(id => !verifiedIds.has(id)).length;
    const chronological = verified.filter(item => activeIds.has(item.id)).sort(compareRosterMessageIds);
    order = chronological.map(item => item.key);
    orderMismatch = chronological.length !== preparedMessages.length || chronological.some((item, index) =>
      item.key !== preparedMessages[index].key || stableRosterContent(item.content) !== stableRosterContent(preparedMessages[index].content)
    );
    // A refused deletion must not be reported as a successful reconciliation.
    remaining = Math.max(remaining, staleIds.size - deleted);
  }

  return {
    ok: failed.length === 0 && remaining === 0 && missing === 0 && !orderMismatch,
    channelId,
    deleted,
    remaining,
    missing,
    order,
    orderMismatch,
    matchedBefore: recentCandidates.length,
    messages: results,
    message: failed.length
      ? `Roster sync failed for ${failed.length}/${results.length} message(s)`
      : remaining || missing
        ? `Roster cleanup incomplete: ${remaining} stale message(s), ${missing} missing page(s). Check the bot's Read Message History and Manage Messages permissions.`
        : orderMismatch
          ? "Roster order changed during sync; retry with a fresh channel snapshot"
          : `Roster verified ${results.length} ordered message(s), cleaned ${deleted} stale message(s)`,
  };
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
      build: MC_DISCORD_PROXY_BUILD,
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

  if (action === "oauth-login") {
    try {
      return jsonResponse(await completeDiscordOAuth(body, expectedSecret, true));
    } catch {
      return jsonResponse({ ok: false, message: "Discord login verification failed. Please try again." }, 502);
    }
  }

  const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!botToken) return jsonResponse({ ok: false, message: "Discord bot token is not configured" }, 500);

  if (action === 'event-notify') {
    let emojis: Record<string,string> = {};
    try { emojis = await getRosterApplicationEmojis(botToken); } catch { /* Text symbols remain readable if Discord emojis are unavailable. */ }
    return jsonResponse(await sendEventNotification(body, botToken, emojis));
  }

  if (action === 'approval-history') {
    try { return jsonResponse(await readApprovalHistory(body, botToken)); }
    catch (error) {
      const reason = error instanceof Error && /^Approval (webhook|channel|message) HTTP \d{3}$/.test(error.message) ? error.message : 'Approval log history unavailable';
      console.error(reason);
      return jsonResponse({ok:false,message:reason},502);
    }
  }

  if (action === "prepare-roster-emojis") {
    try {
      return jsonResponse({ ok: true, emojis: await getRosterApplicationEmojis(botToken, true) });
    } catch (error) {
      return jsonResponse({ ok: false, message: error instanceof Error ? error.message : "Application emoji preparation failed" });
    }
  }

  if (action === "sync-roster-message") {
    try {
      return jsonResponse(await syncRosterMessages(body, botToken));
    } catch (error) {
      return jsonResponse({
        ok: false,
        message: error instanceof Error ? error.message : "Roster sync failed",
      }, 200);
    }
  }

  const resolved = resolveDiscordPath(action, body);
  if (!resolved.ok) return jsonResponse(resolved, 400);

  try {
    const discordResponse = await fetch(`${DISCORD_API_BASE}${resolved.path}`, {
      method: resolved.method,
      headers: {
        Authorization: `Bot ${botToken}`,
        Accept: "application/json",
        "User-Agent": "DiscordBot (THE MC CLUB VERIFY Proxy; 1.0)",
        ...(resolved.payload ? { "Content-Type": "application/json" } : {}),
      },
      ...(resolved.payload ? { body: JSON.stringify(resolved.payload) } : {}),
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
