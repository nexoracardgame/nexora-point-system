import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import {
  ensureLocalStoreFile,
  readLocalStoreJson,
  writeLocalStoreJson,
} from "@/lib/local-store-dir";

export type LocalProfileRecord = {
  userId: string;
  displayName: string | null;
  username: string | null;
  image: string | null;
  coverImage: string | null;
  coverPosition: number | null;
  bio: string | null;
  lineUrl: string | null;
  facebookUrl: string | null;
  updatedAt: string;
};

let supabaseClient: SupabaseClient | null | undefined;
let userProfileSchemaReadyPromise: Promise<void> | null = null;

async function ensureUserProfileSchema() {
  if (!userProfileSchemaReadyPromise) {
    userProfileSchemaReadyPromise = prisma
      .$executeRawUnsafe(
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT'
      )
      .then(() => undefined);
  }

  return userProfileSchemaReadyPromise;
}

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
    supabaseClient = createClient(url, key);
  } catch {
    supabaseClient = null;
  }

  return supabaseClient;
}

function normalizeProfileRecord(
  userId: string,
  raw?: Record<string, unknown> | null
): LocalProfileRecord | null {
  if (!raw) return null;

  return {
    userId,
    displayName:
      String(raw.displayName || raw.displayname || raw.name || "").trim() ||
      null,
    username:
      String(raw.username || raw.userName || raw.handle || "").trim() || null,
    image: String(raw.image || "").trim() || null,
    coverImage:
      String(raw.coverImage || raw.coverimage || "").trim() || null,
    coverPosition:
      typeof raw.coverPosition === "number"
        ? raw.coverPosition
        : typeof raw.coverposition === "number"
          ? raw.coverposition
          : null,
    bio: String(raw.bio || "").trim() || null,
    lineUrl: String(raw.lineUrl || raw.lineurl || "").trim() || null,
    facebookUrl:
      String(raw.facebookUrl || raw.facebookurl || "").trim() || null,
    updatedAt:
      String(raw.updatedAt || raw.updatedat || "").trim() ||
      new Date().toISOString(),
  };
}

async function ensureStoreFile() {
  try {
    return await ensureLocalStoreFile("local-profiles.json");
  } catch {
    return null;
  }
}

async function readStore() {
  const storePath = await ensureStoreFile();

  if (!storePath) {
    return [];
  }

  try {
    return await readLocalStoreJson<LocalProfileRecord>("local-profiles.json");
  } catch {
    return [];
  }
}

async function writeStore(items: LocalProfileRecord[]) {
  const storePath = await ensureStoreFile();

  if (!storePath) {
    return;
  }

  try {
    await writeLocalStoreJson(
      "local-profiles.json",
      JSON.stringify(items, null, 2)
    );
  } catch {
    return;
  }
}

async function readLocalProfile(userId: string) {
  try {
    const items = await readStore();
    return items.find((item) => item.userId === userId) || null;
  } catch {
    return null;
  }
}

async function writeLocalProfile(record: LocalProfileRecord) {
  try {
    const items = await readStore();
    const next = items.some((item) => item.userId === record.userId)
      ? items.map((item) =>
          item.userId === record.userId
            ? {
                ...item,
                ...record,
                username: record.username ?? item.username ?? null,
              }
            : item
        )
      : [record, ...items];

    await writeStore(next);
    return record;
  } catch {
    return record;
  }
}

async function readSupabaseProfile(userId: string) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return normalizeProfileRecord(userId, data as Record<string, unknown>);
  } catch {
    return null;
  }
}

async function readPrismaProfile(userId: string) {
  try {
    await ensureUserProfileSchema();
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT "id", "name", "image", "displayName", "username", "coverImage", "coverPosition", "bio", "lineUrl", "facebookUrl", "createdAt" FROM "User" WHERE "id" = $1 OR "lineId" = $1 LIMIT 1',
      userId
    );
    const data = rows[0];

    if (!data) {
      return null;
    }

    return normalizeProfileRecord(String(data.id || userId), {
      ...data,
      updatedAt: new Date(String(data.createdAt || new Date().toISOString())).toISOString(),
    } as unknown as Record<string, unknown>);
  } catch {
    return null;
  }
}

async function writeSupabaseProfile(
  userId: string,
  input: Omit<LocalProfileRecord, "userId" | "updatedAt">
) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const payload = {
    id: userId,
    name: input.displayName,
    image: input.image,
    displayName: input.displayName,
    username: input.username,
    coverImage: input.coverImage,
    coverPosition: input.coverPosition,
    bio: input.bio,
    lineUrl: input.lineUrl,
    facebookUrl: input.facebookUrl,
    updatedAt: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("users")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return normalizeProfileRecord(userId, data as Record<string, unknown>);
  } catch {
    return null;
  }
}

async function writePrismaProfile(
  userId: string,
  input: Omit<LocalProfileRecord, "userId" | "updatedAt">
) {
  try {
    await ensureUserProfileSchema();
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'UPDATE "User" SET "name" = $2, "displayName" = $2, "username" = $3, "image" = $4, "coverImage" = $5, "coverPosition" = $6, "bio" = $7, "lineUrl" = $8, "facebookUrl" = $9 WHERE "id" = $1 RETURNING "id", "name", "image", "displayName", "username", "coverImage", "coverPosition", "bio", "lineUrl", "facebookUrl", "createdAt"',
      userId,
      input.displayName,
      input.username,
      input.image,
      input.coverImage,
      input.coverPosition,
      input.bio,
      input.lineUrl,
      input.facebookUrl
    );
    const data = rows[0];

    if (!data) {
      return null;
    }

    return normalizeProfileRecord(userId, {
      ...data,
      updatedAt: new Date().toISOString(),
    } as unknown as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function getLocalProfileByUserId(userId: string) {
  const localProfile = await readLocalProfile(userId);
  const prismaProfile = await readPrismaProfile(userId);

  if (prismaProfile) {
    const mergedProfile = {
      ...prismaProfile,
      username: prismaProfile.username ?? localProfile?.username ?? null,
    };
    await writeLocalProfile(mergedProfile).catch(() => mergedProfile);
    return mergedProfile;
  }

  if (localProfile) {
    return localProfile;
  }

  const supabaseProfile = await readSupabaseProfile(userId);

  if (supabaseProfile) {
    const mergedProfile = {
      ...supabaseProfile,
      username: supabaseProfile.username ?? null,
    };
    await writeLocalProfile(mergedProfile).catch(() => mergedProfile);
    return mergedProfile;
  }

  return null;
}

export async function upsertLocalProfile(
  userId: string,
  input: Omit<LocalProfileRecord, "userId" | "updatedAt">
) {
  const currentLocalProfile = await readLocalProfile(userId);
  const nextRecord: LocalProfileRecord = {
    userId,
    updatedAt: new Date().toISOString(),
    ...input,
    username: input.username ?? currentLocalProfile?.username ?? null,
  };

  const [prismaProfile, supabaseProfile, localProfile] = await Promise.allSettled([
    writePrismaProfile(userId, input),
    writeSupabaseProfile(userId, input),
    writeLocalProfile(nextRecord),
  ]);

  if (localProfile.status === "fulfilled" && localProfile.value) {
    return localProfile.value;
  }

  if (prismaProfile.status === "fulfilled" && prismaProfile.value) {
    return {
      ...prismaProfile.value,
      username: nextRecord.username,
    };
  }

  if (supabaseProfile.status === "fulfilled" && supabaseProfile.value) {
    return {
      ...supabaseProfile.value,
      username: nextRecord.username,
    };
  }

  return nextRecord;
}

export async function getAllLocalProfiles() {
  return readStore();
}
