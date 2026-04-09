import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const INPUT_DIR = path.join(ROOT, "public", "cards");
const OUTPUT_DIR = path.join(ROOT, "tm-dataset");

function pad3(n) {
  return String(n).padStart(3, "0");
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function augment(cardNo, inputFile, outDir) {
  const base = sharp(inputFile);

  // ตรง
  await base.resize(224, 224).toFile(path.join(outDir, `${cardNo}-base.jpg`));

  // หมุนซ้าย
  await base
    .rotate(-8)
    .resize(224, 224)
    .toFile(path.join(outDir, `${cardNo}-left.jpg`));

  // หมุนขวา
  await base
    .rotate(8)
    .resize(224, 224)
    .toFile(path.join(outDir, `${cardNo}-right.jpg`));

  // มืด
  await base
    .modulate({ brightness: 0.7 })
    .resize(224, 224)
    .toFile(path.join(outDir, `${cardNo}-dark.jpg`));

  // สว่าง
  await base
    .modulate({ brightness: 1.2 })
    .resize(224, 224)
    .toFile(path.join(outDir, `${cardNo}-bright.jpg`));

  // blur
  await base
    .blur(1)
    .resize(224, 224)
    .toFile(path.join(outDir, `${cardNo}-blur.jpg`));
}

async function main() {
  await ensureDir(OUTPUT_DIR);

  for (let i = 1; i <= 293; i++) {
    const cardNo = pad3(i);
    const exts = [".jpg", ".jpeg", ".png", ".webp"];

    let inputFile = null;
    for (const ext of exts) {
      const test = path.join(INPUT_DIR, `${cardNo}${ext}`);
      if (await fileExists(test)) {
        inputFile = test;
        break;
      }
    }

    if (!inputFile) {
      console.log(`SKIP ${cardNo}`);
      continue;
    }

    const outDir = path.join(OUTPUT_DIR, cardNo);
    await ensureDir(outDir);

    await augment(cardNo, inputFile, outDir);
    console.log(`DONE ${cardNo}`);
  }

  console.log(`🔥 DATASET READY -> ${OUTPUT_DIR}`);
}

main();