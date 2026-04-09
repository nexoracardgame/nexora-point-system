import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const CARDS_DIR = path.join(ROOT, "public", "cards");
const OUT_FILE = path.join(CARDS_DIR, "card-index.json");

function pad3(n) {
  return String(n).padStart(3, "0");
}

function mean(arr) {
  if (!arr.length) return 0;
  let sum = 0;
  for (const v of arr) sum += v;
  return sum / arr.length;
}

function computeAHash(gray, width, height, size = 16) {
  const pixels = [];
  for (let i = 0; i < width * height; i++) {
    pixels.push(gray[i]);
  }
  const avg = mean(pixels);
  let bits = "";
  for (const v of pixels) {
    bits += v >= avg ? "1" : "0";
  }
  return bits;
}

function computeDHash(gray, width, height) {
  let bits = "";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const left = gray[y * width + x];
      const right = gray[y * width + x + 1];
      bits += left > right ? "1" : "0";
    }
  }
  return bits;
}

function computeBlocks(gray, width, height, cols = 4, rows = 4) {
  const out = [];
  const blockW = width / cols;
  const blockH = height / rows;

  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      const startX = Math.floor(bx * blockW);
      const endX = Math.floor((bx + 1) * blockW);
      const startY = Math.floor(by * blockH);
      const endY = Math.floor((by + 1) * blockH);

      let sum = 0;
      let count = 0;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          sum += gray[y * width + x];
          count++;
        }
      }

      out.push(Math.round(sum / Math.max(count, 1)));
    }
  }

  return out;
}

async function toGrayRaw(filePath, width, height) {
  const { data, info } = await sharp(filePath)
    .resize(width, height, { fit: "cover" })
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    gray: Uint8Array.from(data),
    width: info.width,
    height: info.height,
  };
}

async function descriptorForFile(cardNo, filePath) {
  const a16 = await toGrayRaw(filePath, 16, 16);
  const d17 = await toGrayRaw(filePath, 17, 16);
  const b32 = await toGrayRaw(filePath, 32, 32);

  return {
    cardNo,
    aHash: computeAHash(a16.gray, a16.width, a16.height, 16),
    dHash: computeDHash(d17.gray, d17.width, d17.height),
    blocks: computeBlocks(b32.gray, b32.width, b32.height, 4, 4),
  };
}

async function findCardFile(cardNo) {
  const exts = [".jpg", ".jpeg", ".png", ".webp"];
  for (const ext of exts) {
    const filePath = path.join(CARDS_DIR, `${cardNo}${ext}`);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {}
  }
  return null;
}

async function main() {
  const output = [];
  let found = 0;
  let skipped = 0;

  for (let i = 1; i <= 293; i++) {
    const cardNo = pad3(i);
    const filePath = await findCardFile(cardNo);

    if (!filePath) {
      skipped++;
      console.warn(`SKIP ${cardNo}: not found`);
      continue;
    }

    try {
      const desc = await descriptorForFile(cardNo, filePath);
      output.push(desc);
      found++;
      console.log(`OK ${cardNo}`);
    } catch (err) {
      skipped++;
      console.warn(`SKIP ${cardNo}:`, err?.message || err);
    }
  }

  await fs.writeFile(OUT_FILE, JSON.stringify(output));
  console.log(`\nDone.`);
  console.log(`Found: ${found}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Output: ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});