import { copyFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const outputDir = path.join(rootDir, "dist", "desktop");
const publicDownloadDir = path.join(rootDir, "public", "downloads", "windows");
const packageJson = JSON.parse(
  await readFile(path.join(rootDir, "package.json"), "utf8")
);
const setupName = `NEXORA-Point-Setup-${packageJson.version}.exe`;
const stableSetupName = "NEXORA-Point-Setup.exe";

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

await mkdir(publicDownloadDir, { recursive: true });

const files = await readdir(outputDir).catch(() => []);
const requiredFiles = [
  setupName,
  `${setupName}.blockmap`,
  "latest.yml",
];

for (const file of requiredFiles) {
  const source = path.join(outputDir, file);

  if (!(await exists(source))) {
    throw new Error(`Missing desktop release artifact: ${path.relative(rootDir, source)}`);
  }

  await copyFile(source, path.join(publicDownloadDir, file));
}

await copyFile(
  path.join(outputDir, setupName),
  path.join(publicDownloadDir, stableSetupName)
);

for (const file of files) {
  if (!file.endsWith(".blockmap")) continue;
  const source = path.join(outputDir, file);
  const destination = path.join(publicDownloadDir, file);
  if (await exists(destination)) continue;
  await copyFile(source, destination);
}

console.log(`Staged Windows installer to ${path.relative(rootDir, publicDownloadDir)}`);
