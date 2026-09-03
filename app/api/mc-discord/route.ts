export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const ALLOWED_ACTIONS = new Set([
  "assign-role",
  "bot",
  "guild",
  "guild-list",
  "roles",
]);

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function cleanSnowflake(value: unknown) {
  return String(value || "").replace(/[^\d]/g, "").slice(0, 32);
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

export async function POST(request: Request) {
  const expectedSecret = process.env.MC_DISCORD_PROXY_SECRET?.trim();
  if (!expectedSecret) {
    return jsonResponse({ ok: false, message: "Proxy secret is not configured" }, 500);
  }

  const incomingSecret = request.headers.get("x-mc-discord-proxy-secret")?.trim();
  if (incomingSecret !== expectedSecret) {
    return jsonResponse({ ok: false, message: "Invalid proxy secret" }, 401);
  }

  const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!botToken) return jsonResponse({ ok: false, message: "Discord bot token is not configured" }, 500);

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
