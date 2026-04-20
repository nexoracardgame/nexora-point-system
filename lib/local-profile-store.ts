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

export async function getLocalProfileByUserId(userId: string) {
  const items = await readStore();
  return items.find((item) => item.userId === userId) || null;
}

export async function upsertLocalProfile(
  userId: string,
  input: Omit<LocalProfileRecord, "userId" | "updatedAt">
) {
  const items = await readStore();
  const nextRecord: LocalProfileRecord = {
    userId,
    updatedAt: new Date().toISOString(),
    ...input,
  };

  const next = items.some((item) => item.userId === userId)
    ? items.map((item) => (item.userId === userId ? nextRecord : item))
    : [nextRecord, ...items];

  await writeStore(next);
  return nextRecord;
}
