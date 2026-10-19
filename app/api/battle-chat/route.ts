import { NextResponse } from "next/server";
import { getApiActor } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import type { BattleChatMessage } from "@/lib/battle-chat-messages";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });

export async function GET(request: Request) {
  const actor = await getApiActor();
  if (!actor) return json({ error: "unauthorized" }, 401);
  const params = new URL(request.url).searchParams, mode = params.get("mode"), code = params.get("room") || "";
  if (!/^\d{6}$/.test(code) || (mode !== "triad" && mode !== "pentad")) return json({ error: "invalid_room" }, 400);
  try {
    // Read only chat, with membership enforced in SQL. Never acquire the game mutation lock.
    const rows = mode === "triad"
      ? await prisma.$queryRawUnsafe<{ messages: unknown[] }[]>(`SELECT "game"->'chat' AS messages FROM "TriadRoom" WHERE code = $1 AND (seats->'host'->>'id' = $2 OR seats->'challenger'->>'id' = $2 OR EXISTS (SELECT 1 FROM jsonb_array_elements(spectators) p WHERE p->>'id' = $2))`, code, actor.id)
      : await prisma.$queryRawUnsafe<{ messages: unknown[] }[]>(`SELECT data->'chat' AS messages FROM "PentadRoom" WHERE code = $1 AND (data->'seats'->'host'->>'id' = $2 OR data->'seats'->'challenger'->>'id' = $2 OR EXISTS (SELECT 1 FROM jsonb_array_elements(data->'spectators') p WHERE p->>'id' = $2))`, code, actor.id);
    if (!rows.length) return json({ error: "not_in_room" }, 403);
    const messages: BattleChatMessage[] = (Array.isArray(rows[0].messages) ? rows[0].messages : []).slice(-80).map(raw => {
      const item = raw as Record<string, unknown>, id = String(item.id || "");
      return { id, senderId: String(mode === "triad" ? item.senderId || "" : id.slice(0, id.lastIndexOf(":"))), senderName: String(item.senderName || item.name || "PLAYER"), text: String(item.text || ""), createdAt: Number(item.createdAt || item.at || 0) };
    });
    return json({ messages });
  } catch { return json({ error: "chat_unavailable" }, 503); }
}
