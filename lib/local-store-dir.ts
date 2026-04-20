import { promises as fs } from "fs";
import os from "os";
import path from "path";

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

export async function getLocalStorePath(fileName: string) {
  const preferredDir = path.join(process.cwd(), "data");
  const fallbackDir = path.join(os.tmpdir(), "nexora-point-system-data");
  const preferredPath = path.join(preferredDir, fileName);
  const fallbackPath = path.join(fallbackDir, fileName);

  if (await canWriteToDir(preferredDir)) {
    return preferredPath;
  }

  await fs.mkdir(fallbackDir, { recursive: true });

  try {
    await fs.access(fallbackPath);
    return fallbackPath;
  } catch {
    try {
      const preferredRaw = await fs.readFile(preferredPath, "utf8");
      await fs.writeFile(fallbackPath, preferredRaw, "utf8");
    } catch {
      await fs.writeFile(fallbackPath, "[]", "utf8");
    }
  }

  return fallbackPath;
}
