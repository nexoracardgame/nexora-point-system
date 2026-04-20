import { createClient } from "@supabase/supabase-js";
import {
  ensureLocalStoreFile,
  readLocalStoreJson,
  writeLocalStoreJson,
} from "@/lib/local-store-dir";

export type LocalProfileRecord = {
  userId: string;
  displayName: string | null;
  image: string | null;
  coverImage: string | null;
  coverPosition: number | null;
  bio: string | null;
  lineUrl: string | null;
  facebookUrl: string | null;
  updatedAt: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  return ensureLocalStoreFile("local-profiles.json");
}

async function readStore() {
  await ensureStoreFile();
  return readLocalStoreJson<LocalProfileRecord>("local-profiles.json");
}

async function writeStore(items: LocalProfileRecord[]) {
  await ensureStoreFile();
  await writeLocalStoreJson(
    "local-profiles.json",
    JSON.stringify(items, null, 2)
  );
}

async function readLocalProfile(userId: string) {
  const items = await readStore();
  return items.find((item) => item.userId === userId) || null;
}

async function writeLocalProfile(record: LocalProfileRecord) {
  const items = await readStore();
  const next = items.some((item) => item.userId === record.userId)
    ? items.map((item) => (item.userId === record.userId ? record : item))
    : [record, ...items];

  await writeStore(next);
  return record;
}

async function readSupabaseProfile(userId: string) {
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

async function writeSupabaseProfile(
  userId: string,
  input: Omit<LocalProfileRecord, "userId" | "updatedAt">
) {
  const payload = {
    id: userId,
    name: input.displayName,
    image: input.image,
    displayName: input.displayName,
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

export async function getLocalProfileByUserId(userId: string) {
  const supabaseProfile = await readSupabaseProfile(userId);

  if (supabaseProfile) {
    void writeLocalProfile(supabaseProfile).catch(() => undefined);
    return supabaseProfile;
  }

  return readLocalProfile(userId);
}

export async function upsertLocalProfile(
  userId: string,
  input: Omit<LocalProfileRecord, "userId" | "updatedAt">
) {
  const nextRecord: LocalProfileRecord = {
    userId,
    updatedAt: new Date().toISOString(),
    ...input,
  };

  const [supabaseProfile, localProfile] = await Promise.allSettled([
    writeSupabaseProfile(userId, input),
    writeLocalProfile(nextRecord),
  ]);

  if (supabaseProfile.status === "fulfilled" && supabaseProfile.value) {
    return supabaseProfile.value;
  }

  if (localProfile.status === "fulfilled" && localProfile.value) {
    return localProfile.value;
  }

  return nextRecord;
}
