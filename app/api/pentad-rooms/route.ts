import { after, NextResponse } from "next/server";
import { getApiActor } from "@/lib/admin-auth";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { createPentadRoom, listPentadRooms, mutatePentadRoom } from "@/lib/pentad-room-store";

export const dynamic = "force-dynamic";
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}
function errorJson(error: unknown, fallback: string) {
  const databaseError = error && typeof error === "object" && ("code" in error || "clientVersion" in error);
  return json({ error: databaseError ? "เซิร์ฟเวอร์ยังไม่พร้อม กรุณาลองอีกครั้ง" : error instanceof Error ? error.message : fallback }, databaseError ? 503 : 409);
}
function notify(code: string) {
  after(async () => {
    const supabase = getServerSupabaseClient();
    if (!supabase) return;
    const channel = supabase.channel(`pentad:${code}`);
    try { await channel.send({ type: "broadcast", event: "changed", payload: { code } }, { timeout: 500 }); }
    catch { /* HTTP polling remains available if realtime is offline. */ }
    finally { void supabase.removeChannel(channel); }
  });
}
export async function GET(request: Request) {
  const actor = await getApiActor();
  if (!actor) return json({ error: "unauthorized" }, 401);
  const code = new URL(request.url).searchParams.get("room");
  try {
    if (!code) return json({ rooms: await listPentadRooms() });
    if (!/^\d{6}$/.test(code)) return json({ error: "รหัสห้องไม่ถูกต้อง" }, 400);
    return json({ room: await mutatePentadRoom(code, { id: actor.id, name: actor.name || "PLAYER", image: actor.image || "/avatar.png" }) });
  } catch (error) { return errorJson(error, "โหลดห้องไม่สำเร็จ"); }
}
export async function POST(request: Request) {
  const actor = await getApiActor();
  if (!actor) return json({ error: "unauthorized" }, 401);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "ข้อมูลไม่ถูกต้อง" }, 400);
  const participant = { id: actor.id, name: actor.name || "PLAYER", image: actor.image || "/avatar.png" };
  try {
    if (body.action === "create") { const room = await createPentadRoom(participant, body.deckSource === "random" ? "random" : "all"); return json({ room }); }
    const code = String(body.code || "");
    if (!/^\d{6}$/.test(code)) return json({ error: "รหัสห้องไม่ถูกต้อง" }, 400);
    const room = await mutatePentadRoom(code, participant, body);
    notify(code); return json({ room });
  } catch (error) { return errorJson(error, "คำสั่งไม่สำเร็จ"); }
}
