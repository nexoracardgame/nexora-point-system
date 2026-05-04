import { mkdir, writeFile } from "fs/promises";
import crypto from "crypto";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_PROFILE_IMAGE = "/avatar.png";
const MAX_PROFILE_IMAGE_BYTES = 6 * 1024 * 1024;
const SNAPSHOT_BUCKET = "chat-images";
const SNAPSHOT_PREFIX = "profile-assets/oauth-initial";
const FETCH_TIMEOUT_MS = 5000;

let supabaseClient: SupabaseClient | null | undefined;

type SnapshotTarget = {
  userId?: string | null;
  lineId?: string | null;
  provider?: string | null;
};

type DownloadedImage = {
  buffer: Buffer;
  contentType: string;
};

function getSupabaseClient() {
  if (supabaseClient !== undefined) {
    return supabaseClient;
  }

  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ""
  ).trim();

  if (!url || !key) {
    supabaseClient = null;
    return supabaseClient;
  }

  try {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch {
    supabaseClient = null;
  }

  return supabaseClient;
}

export function isDefaultProfileImageUrl(value?: string | null) {
  const image = String(value || "").trim();
  return !image || image === DEFAULT_PROFILE_IMAGE;
}

export function isLineProfileImageUrl(value?: string | null) {
  const image = String(value || "").trim();

  if (!image) {
    return false;
  }

  try {
    const url = new URL(image);
    return (
      url.protocol === "https:" &&
      (url.hostname === "profile.line-scdn.net" ||
        url.hostname.endsWith(".line-scdn.net"))
    );
  } catch {
    return false;
  }
}

export function isGoogleProfileImageUrl(value?: string | null) {
  const image = String(value || "").trim();

  if (!image) {
    return false;
  }

  try {
    const url = new URL(image);
    return (
      url.protocol === "https:" &&
      (url.hostname === "googleusercontent.com" ||
        url.hostname.endsWith(".googleusercontent.com"))
    );
  } catch {
    return false;
  }
}

export function isProviderProfileImageUrl(value?: string | null) {
  return isLineProfileImageUrl(value) || isGoogleProfileImageUrl(value);
}

function normalizeContentType(value?: string | null) {
  const contentType = String(value || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (
    contentType === "image/jpeg" ||
    contentType === "image/png" ||
    contentType === "image/webp" ||
    contentType === "image/avif"
  ) {
    return contentType;
  }

  return null;
}

function extensionForImage(contentType: string, sourceUrl: string) {
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "image/avif") return ".avif";

  try {
    const ext = path.extname(new URL(sourceUrl).pathname).toLowerCase();

    if (ext === ".png" || ext === ".webp" || ext === ".avif") {
      return ext;
    }
  } catch {
    return ".jpg";
  }

  return ".jpg";
}

function safeFileSegment(value?: string | null, fallback = "user") {
  const segment = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);

  return segment || fallback;
}

async function downloadProfileImage(sourceUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(sourceUrl, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const contentType = normalizeContentType(response.headers.get("content-type"));

    if (!contentType) {
      return null;
    }

    const contentLength = Number(response.headers.get("content-length") || 0);

    if (contentLength > MAX_PROFILE_IMAGE_BYTES) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength > MAX_PROFILE_IMAGE_BYTES) {
      return null;
    }

    return {
      buffer: Buffer.from(arrayBuffer),
      contentType,
    } satisfies DownloadedImage;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function uploadSnapshotToSupabase(
  fileName: string,
  image: DownloadedImage
) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  try {
    const { error } = await supabase.storage
      .from(SNAPSHOT_BUCKET)
      .upload(fileName, image.buffer, {
        upsert: false,
        contentType: image.contentType,
        cacheControl: "31536000",
      });

    if (error) {
      return null;
    }

    const { data } = supabase.storage.from(SNAPSHOT_BUCKET).getPublicUrl(fileName);
    return data.publicUrl || null;
  } catch {
    return null;
  }
}

async function writeSnapshotLocally(fileName: string, image: DownloadedImage) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  try {
    const localFileName = path.basename(fileName);
    const uploadDir = path.join(process.cwd(), "public", "uploads", "profile");

    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, localFileName), image.buffer);

    return `/uploads/profile/${localFileName}`;
  } catch {
    return null;
  }
}

export async function createProviderProfileImageSnapshot(
  sourceUrl: string,
  target: SnapshotTarget = {}
) {
  const safeSourceUrl = String(sourceUrl || "").trim();

  if (!isProviderProfileImageUrl(safeSourceUrl)) {
    return null;
  }

  const image = await downloadProfileImage(safeSourceUrl);

  if (!image) {
    return null;
  }

  const owner = safeFileSegment(target.userId || target.lineId);
  const provider = safeFileSegment(target.provider, "oauth");
  const externalId = safeFileSegment(target.lineId, provider);
  const digest = crypto
    .createHash("sha256")
    .update(safeSourceUrl)
    .digest("hex")
    .slice(0, 12);
  const ext = extensionForImage(image.contentType, safeSourceUrl);
  const fileName = `${SNAPSHOT_PREFIX}/${provider}-${owner}-${externalId}-${digest}-${Date.now()}-${crypto.randomUUID()}${ext}`;

  return (
    (await uploadSnapshotToSupabase(fileName, image)) ||
    (await writeSnapshotLocally(fileName, image))
  );
}

export async function createLineProfileImageSnapshot(
  sourceUrl: string,
  target: SnapshotTarget = {}
) {
  return createProviderProfileImageSnapshot(sourceUrl, {
    ...target,
    provider: target.provider || "line",
  });
}
