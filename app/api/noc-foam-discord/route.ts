import { createHmac, createPublicKey, verify } from "node:crypto";
import { after } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_SCRIPT = "https://script.google.com/macros/s/AKfycbzCJozWvXbAfgQk_WcuudfKO-uzCDO3NyCDDdsTFbiUFvxWfXBgHe8xCZhBYHKyEN1F/exec";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const privateReply = (content: string) => json({ type: 4, data: { content, flags: 64, allowed_mentions: { parse: [] } } });

export async function POST(request: Request) {
  const publicKey = process.env.NOC_DISCORD_PUBLIC_KEY?.trim() || "d34fe47b36637b5f5c849e09ec6d81251276dacff8bcc0e6b9cfa1f2876d7c3e";
  const signature = request.headers.get("x-signature-ed25519") || "";
  const timestamp = request.headers.get("x-signature-timestamp") || "";
  if (!/^[a-f0-9]{64}$/i.test(publicKey) || !/^[a-f0-9]{128}$/i.test(signature) || !/^\d{10}$/.test(timestamp) ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return json({ error: "Invalid signature" }, 401);
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > 65536) return json({ error: "Payload too large" }, 413);
  try {
    const key = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(publicKey, "hex")]), format: "der", type: "spki" });
    if (!verify(null, Buffer.concat([Buffer.from(timestamp), raw]), key, Buffer.from(signature, "hex"))) return json({ error: "Invalid signature" }, 401);
  } catch { return json({ error: "Invalid signature" }, 401); }

  let data;
  try { data = JSON.parse(raw.toString("utf8")); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!data || typeof data !== "object") return json({ error: "Invalid interaction" }, 400);
  if (data.type === 1) return json({ type: 1 });
  const appId = process.env.NOC_DISCORD_APPLICATION_ID?.trim() || "1560911732455514182";
  const webhookSecret = process.env.NOC_FOAM_WEBHOOK_SECRET;
  const controlSecret = process.env.NOC_DISCORD_CONTROL_SECRET || (webhookSecret ? createHmac("sha256", webhookSecret).update("noc-foam-discord-control-v1").digest("hex") : "");
  if (!appId || data.application_id !== appId || !controlSecret || !webhookSecret) return privateReply("ยังไม่ได้ตั้งค่าการควบคุม NOC AI ให้ครบครับ");
  const customId = String(data.data?.custom_id || "");
  const match = customId.match(/^noc:(idle|pause2|pause6|resume|off|confirmoff):([UCR][a-f0-9]{32})$/i);
  const userId = String(data.member?.user?.id || "");
  if (data.type !== 3 || data.data?.component_type !== 2 || !match || !/^\d{17,20}$/.test(userId) ||
      !/^\d{17,20}$/.test(String(data.id || "")) || !/^[A-Za-z0-9._-]+$/.test(String(data.token || ""))) return privateReply("คำสั่งไม่ถูกต้องครับ");
  if (match[1] === "off") return json({ type: 4, data: {
    content: "ยืนยันปิด AI ถาวรเฉพาะห้อง #" + match[2].slice(-6) + "? เปิดกลับได้ด้วยปุ่มเปิด AI ครับ",
    flags: 64, allowed_mentions: { parse: [] },
    components: [{ type: 1, components: [{ type: 2, style: 4, label: "ยืนยันปิด AI ถาวร", custom_id: "noc:confirmoff:" + match[2] }] }]
  } });

  // Acknowledge immediately; Apps Script may take longer than Discord's 3-second deadline.
  after(async () => {
    let content = "ดำเนินการไม่สำเร็จ กรุณาลองใหม่ ยังไม่ยืนยันว่ามีการเปลี่ยนสถานะครับ";
    try {
      const target = new URL(process.env.NOC_FOAM_APPS_SCRIPT_WEBHOOK_URL || DEFAULT_SCRIPT);
      target.searchParams.set("secret", webhookSecret);
      const upstream = await fetch(target, {
        method: "POST", headers: { "Content-Type": "application/json" }, redirect: "follow", signal: AbortSignal.timeout(40000),
        body: JSON.stringify({ controlSecret, discordControl: {
          interactionId: data.id, userId, guildId: data.guild_id, channelId: data.channel_id,
          customId: customId.replace("noc:confirmoff:", "noc:off:")
        } })
      });
      const result = await upstream.json();
      if (upstream.ok && typeof result.message === "string") content = result.message.slice(0, 1800);
    } catch { console.error("NOC Discord control upstream failed"); }
    try {
      const response = await fetch(`https://discord.com/api/v10/webhooks/${appId}/${data.token}/messages/@original`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ content, allowed_mentions: { parse: [] }, components: [] })
      });
      if (!response.ok) console.error("NOC Discord private result failed", response.status);
    } catch { console.error("NOC Discord private result unavailable"); }
  });
  return json({ type: 5, data: { flags: 64 } });
}
