import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "public", "card-sets");
const outputDir = path.join(sourceDir, "optimized");
const manifestPath = path.join(root, "lib", "card-set-images.ts");
const extensions = [".png", ".jpg", ".jpeg", ".webp"];
const sourceExtensions = new Map();

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
      sourceExtensions.set(order, extension.slice(1));
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

const version = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const manifest = `const CARD_SET_SOURCE_EXTENSIONS: Record<number, string> = {
${Array.from(sourceExtensions.entries())
  .sort(([a], [b]) => a - b)
  .map(([order, extension]) => `  ${order}: "${extension}",`)
  .join("\n")}
};

export const CARD_SET_IMAGE_VERSION = "${version}-card-set";

export function getCardSetImageUrls(order: number) {
  const extension = CARD_SET_SOURCE_EXTENSIONS[order] || "png";

  return {
    coverImage: \`/card-sets/optimized/\${order}.webp?v=\${CARD_SET_IMAGE_VERSION}\`,
    fallbackImage: \`/card-sets/\${order}.\${extension}?v=\${CARD_SET_IMAGE_VERSION}\`,
  };
}
`;

await fs.writeFile(manifestPath, manifest);
console.log(`Updated ${path.relative(root, manifestPath)}.`);
