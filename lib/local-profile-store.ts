import { promises as fs } from "fs";
import { getLocalStorePath } from "@/lib/local-store-dir";

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
  const storePath = await getLocalStorePath("local-profiles.json");

  try {
    await fs.access(storePath);
  } catch {
    await fs.writeFile(storePath, "[]", "utf8");
  }

  return storePath;
}

async function readStore() {
  const storePath = await ensureStoreFile();

  try {
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalProfileRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeStore(items: LocalProfileRecord[]) {
  const storePath = await ensureStoreFile();
  await fs.writeFile(storePath, JSON.stringify(items, null, 2), "utf8");
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
