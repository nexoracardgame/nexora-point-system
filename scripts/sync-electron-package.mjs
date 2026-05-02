import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const rootPackagePath = path.join(rootDir, "package.json");
const desktopPackagePath = path.join(rootDir, "desktop", "package.json");

const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
const desktopPackage = JSON.parse(await readFile(desktopPackagePath, "utf8"));

desktopPackage.version = rootPackage.version;

await writeFile(
  desktopPackagePath,
  `${JSON.stringify(desktopPackage, null, 2)}\n`
);

console.log(`Synced desktop package version ${desktopPackage.version}`);
