import { promises as fs } from "fs";
import os from "os";
import path from "path";

const storePathCache = new Map<string, Promise<string>>();
const storeWriteQueues = new Map<string, Promise<void>>();

async function canWriteToDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
    const probePath = path.join(
      dir,
      `.probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`
    );
    await fs.writeFile(probePath, "ok", "utf8");
    await fs.unlink(probePath).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

function getCandidateDirs() {
  const configuredDir = String(process.env.LOCAL_STORE_DIR || "").trim();

  return [
    configuredDir || null,
    path.join(process.cwd(), "data"),
    path.join(process.cwd(), ".nexora-runtime-data"),
    path.join(os.tmpdir(), "nexora-point-system-data"),
  ].filter((dir): dir is string => Boolean(dir));
}

async function seedStoreFile(targetPath: string, fileName: string, emptyValue: string) {
  const bundledPath = path.join(process.cwd(), "data", fileName);

  try {
    const bundledRaw = await fs.readFile(bundledPath, "utf8");
    await fs.writeFile(targetPath, bundledRaw, "utf8");
    return;
  } catch {
    await fs.writeFile(targetPath, emptyValue, "utf8");
  }
}

async function resolveStorePath(fileName: string, emptyValue: string) {
  const candidateDirs = getCandidateDirs();

  for (const dir of candidateDirs) {
    if (!(await canWriteToDir(dir))) {
      continue;
    }

    const storePath = path.join(dir, fileName);

    try {
      await fs.access(storePath);
    } catch {
      await seedStoreFile(storePath, fileName, emptyValue);
    }

    return storePath;
  }

  throw new Error(`No writable local store directory available for ${fileName}`);
}

export async function getLocalStorePath(fileName: string, emptyValue = "[]") {
  const cacheKey = `${fileName}::${emptyValue}`;

  if (!storePathCache.has(cacheKey)) {
    storePathCache.set(cacheKey, resolveStorePath(fileName, emptyValue));
  }

  return storePathCache.get(cacheKey)!;
}

export async function ensureLocalStoreFile(fileName: string, emptyValue = "[]") {
  const storePath = await getLocalStorePath(fileName, emptyValue);

  try {
    await fs.access(storePath);
  } catch {
    await seedStoreFile(storePath, fileName, emptyValue);
  }

  return storePath;
}

export async function readLocalStoreJson<T>(
  fileName: string,
  emptyValue = "[]"
): Promise<T[]> {
  const storePath = await ensureLocalStoreFile(fileName, emptyValue);

  try {
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export async function writeLocalStoreJson(
  fileName: string,
  raw: string,
  emptyValue = "[]"
) {
  const storePath = await ensureLocalStoreFile(fileName, emptyValue);
  const previousWrite = storeWriteQueues.get(storePath) || Promise.resolve();

  const nextWrite = previousWrite.catch(() => undefined).then(async () => {
    const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, raw, "utf8");
    await fs.rename(tempPath, storePath);
  });

  storeWriteQueues.set(storePath, nextWrite);
  await nextWrite;
}
