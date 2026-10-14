import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "mc-profile-photos";
const MAX_BYTES = 2 * 1024 * 1024;
const NO_CACHE = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

function storage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)?.trim();
  if (!url || !key) throw new Error("Photo storage is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  }).storage;
}

function memberKey(value: unknown) {
  const text = String(value ?? "");
  if (!/^\d{1,3}$/.test(text) || Number(text) > 300) throw new Error("Invalid member number");
  return String(Number(text)).padStart(3, "0");
}

function versionKey(value: unknown) {
  const valueString = String(value ?? "");
  if (!/^[a-f0-9]{32}$/.test(valueString)) throw new Error("Invalid photo version");
  return valueString;
}

function authorized(request: Request) {
  const expected = process.env.MC_DISCORD_PROXY_SECRET?.trim();
  const supplied = request.headers.get("x-mc-discord-proxy-secret") || "";
  if (!expected || supplied.length !== expected.length) return false;
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function ensureBucket(client: ReturnType<typeof storage>) {
  const existing = await client.getBucket(BUCKET);
  if (!existing.error) {
    if (existing.data.public) throw new Error("Profile photo storage must be private");
    return;
  }
  const created = await client.createBucket(BUCKET, {
    public: false, fileSizeLimit: MAX_BYTES, allowedMimeTypes: ["image/webp"],
  });
  if (created.error) {
    const retry = await client.getBucket(BUCKET);
    if (retry.error || retry.data.public) throw new Error("Cannot initialize private photo storage");
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401, headers: NO_CACHE });
  try {
    // Only Apps Script may upload or reconcile files, after checking membership under its lock.
    const bodyText = await request.text();
    if (bodyText.length > Math.ceil(MAX_BYTES * 4 / 3) + 1024) throw new Error("Photo is too large");
    const body = JSON.parse(bodyText);
    const banner = body.asset === "login-banner";
    const wallpaper = body.asset === "app-wallpaper";
    const member = banner ? "login-banner" : wallpaper ? "app-wallpaper" : memberKey(body.memberNo);
    const client = storage();
    if (body.action === "upload") {
      const version = versionKey(body.version);
      const base64 = body.base64;
      if (typeof base64 !== "string" || !base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error("Invalid image data");
      const input = Buffer.from(base64, "base64");
      if (!input.length || input.length > MAX_BYTES) throw new Error("Photo is too large");
      const pipeline = sharp(input, { limitInputPixels: 36_000_000, failOn: "error" });
      const metadata = await pipeline.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format || "") || (metadata.pages || 1) > 1) throw new Error("Use a still JPEG, PNG or WebP photo");
      const photo = await pipeline.rotate().resize({ width: banner || wallpaper ? 2560 : 1600, height: banner || wallpaper ? 1440 : 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 90, effort: 4 }).toBuffer();
      if (photo.length > MAX_BYTES) throw new Error("Photo is too large after processing");
      await ensureBucket(client);
      const result = await client.from(BUCKET).upload(`${member}/${version}.webp`, photo, {
        contentType: "image/webp", cacheControl: "0", upsert: false,
      });
      if (result.error) throw new Error("Photo upload failed");
      return Response.json({ ok: true, version, bytes: photo.length }, { headers: NO_CACHE });
    }
    if (body.action === "reconcile") {
      const versions: unknown[] = banner && Array.isArray(body.keepVersions) ? body.keepVersions : body.keepVersion ? [body.keepVersion] : [];
      if (versions.length > (banner ? 3 : 1)) throw new Error("Too many retained photos");
      const keep = new Set(versions.map(value => `${versionKey(value)}.webp`));
      const bucket = client.from(BUCKET);
      const files: string[] = [];
      for (let offset = 0; ; offset += 100) {
        const listed = await bucket.list(member, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
        if (listed.error) throw new Error("Cannot list old profile photos");
        files.push(...listed.data.map(file => file.name));
        if (listed.data.length < 100) break;
      }
      const obsolete = files.filter(name => /^[a-f0-9]{32}\.webp$/.test(name) && !keep.has(name));
      if (obsolete.length) {
        const removed = await bucket.remove(obsolete.map(name => `${member}/${name}`));
        if (removed.error) throw new Error("Cannot remove old profile photos");
      }
      return Response.json({ ok: true, removed: obsolete.length }, { headers: NO_CACHE });
    }
    throw new Error("Invalid photo action");
  } catch (error) {
    console.error("MC photo operation failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false, message: "Photo could not be saved. Please retry." }, { status: 400, headers: NO_CACHE });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  let member: string, version: string;
  try {
    const asset = url.searchParams.get("asset");
    member = asset === "login-banner" || asset === "app-wallpaper" ? asset : memberKey(url.searchParams.get("member"));
    version = versionKey(url.searchParams.get("v"));
  } catch {
    return new Response(null, { status: 404, headers: NO_CACHE });
  }
  // A temporary storage failure must not be reported as a permanently missing photo.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await storage().from(BUCKET).download(`${member}/${version}.webp`);
      if (result.error) {
        const error = result.error as { statusCode?: string | number; code?: string; message?: string };
        if (Number(error.statusCode) === 404 || error.code === "NoSuchKey" ||
            (Number(error.statusCode) === 400 && error.message === "Object not found")) {
          return new Response(null, { status: 404, headers: NO_CACHE });
        }
        throw new Error("Photo storage unavailable");
      }
      if (!result.data) throw new Error("Empty storage response");
      let bytes: Buffer = Buffer.from(await result.data.arrayBuffer());
      if (!bytes.length) throw new Error("Empty photo");
      if (url.searchParams.get("size") === "card") {
        try {
          bytes = await sharp(bytes).resize({ width: member === "login-banner" ? 960 : 640, height: member === "login-banner" ? 540 : 800, fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
        } catch {
          // The validated original is still usable if thumbnail processing is unavailable.
          console.warn("MC photo thumbnail unavailable; serving original");
        }
      }
      return new Response(new Uint8Array(bytes), { headers: { ...NO_CACHE, "Content-Type": "image/webp", "Cross-Origin-Resource-Policy": "cross-origin" } });
    } catch {
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  console.warn("MC photo storage temporarily unavailable");
  return new Response(null, { status: 503, headers: { ...NO_CACHE, "Retry-After": "5" } });
}
