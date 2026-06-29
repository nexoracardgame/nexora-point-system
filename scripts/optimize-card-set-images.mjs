import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "public", "card-sets");
const outputDir = path.join(sourceDir, "optimized");
const extensions = [".png", ".jpg", ".jpeg", ".webp"];

await fs.mkdir(outputDir, { recursive: true });

let optimizedCount = 0;
let skippedCount = 0;

for (let order = 1; order <= 40; order += 1) {
  let sourcePath = "";

  for (const extension of extensions) {
    const candidate = path.join(sourceDir, `${order}${extension}`);
    try {
      await fs.access(candidate);
      sourcePath = candidate;
      break;
    } catch {
      continue;
    }
  }

  if (!sourcePath) {
    skippedCount += 1;
    continue;
  }

  const outputPath = path.join(outputDir, `${order}.webp`);
  await sharp(sourcePath, { limitInputPixels: false })
    .rotate()
    .resize({
      width: 900,
      height: 700,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: 78,
      effort: 6,
      smartSubsample: true,
    })
    .toFile(outputPath);

  optimizedCount += 1;
}

console.log(
  `Optimized ${optimizedCount} card set images into public/card-sets/optimized. Skipped ${skippedCount}.`
);
