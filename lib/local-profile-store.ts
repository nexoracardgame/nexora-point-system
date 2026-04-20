import { promises as fs } from "fs";
import path from "path";

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

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "local-profiles.json");

async function ensureStoreFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "[]", "utf8");
  }
}

async function readStore() {
  await ensureStoreFile();

  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalProfileRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeStore(items: LocalProfileRecord[]) {
  await ensureStoreFile();
  await fs.writeFile(STORE_PATH, JSON.stringify(items, null, 2), "utf8");
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
