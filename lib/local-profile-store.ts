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
  image: string | null;
  coverImage: string | null;
  coverPosition: number | null;
  bio: string | null;
  lineUrl: string | null;
  facebookUrl: string | null;
  updatedAt: string;
};

let supabaseClient: SupabaseClient | null | undefined;

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
      ? items.map((item) => (item.userId === record.userId ? record : item))
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
    const data = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        image: true,
        displayName: true,
        coverImage: true,
        coverPosition: true,
        bio: true,
        lineUrl: true,
        facebookUrl: true,
        createdAt: true,
      },
    });

    if (!data) {
      return null;
    }

    return normalizeProfileRecord(userId, {
      ...data,
      updatedAt: data.createdAt.toISOString(),
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
    const data = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        name: input.displayName,
        displayName: input.displayName,
        image: input.image,
        coverImage: input.coverImage,
        coverPosition: input.coverPosition,
        bio: input.bio,
        lineUrl: input.lineUrl,
        facebookUrl: input.facebookUrl,
      },
      select: {
        id: true,
        name: true,
        image: true,
        displayName: true,
        coverImage: true,
        coverPosition: true,
        bio: true,
        lineUrl: true,
        facebookUrl: true,
        createdAt: true,
      },
    });

    return normalizeProfileRecord(userId, {
      ...data,
      updatedAt: new Date().toISOString(),
    } as unknown as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function getLocalProfileByUserId(userId: string) {
  const prismaProfile = await readPrismaProfile(userId);

  if (prismaProfile) {
    void Promise.allSettled([
      writeLocalProfile(prismaProfile),
    ]).catch(() => undefined);
    return prismaProfile;
  }

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

  const [prismaProfile, supabaseProfile, localProfile] = await Promise.allSettled([
    writePrismaProfile(userId, input),
    writeSupabaseProfile(userId, input),
    writeLocalProfile(nextRecord),
  ]);

  if (prismaProfile.status === "fulfilled" && prismaProfile.value) {
    return prismaProfile.value;
  }

  if (supabaseProfile.status === "fulfilled" && supabaseProfile.value) {
    return supabaseProfile.value;
  }

  if (localProfile.status === "fulfilled" && localProfile.value) {
    return localProfile.value;
  }

  return nextRecord;
}
