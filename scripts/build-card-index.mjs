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
  let sum = 0;
  for (const v of arr) sum += v;
  return arr.length ? sum / arr.length : 0;
}

function computeAHash(gray, width, height) {
  const avg = mean(gray);
  let bits = "";
  for (const v of gray) {
    bits += v >= avg ? "1" : "0";
  }
  return bits;
}

async function descriptorForFile(cardNo, filePath) {
  // 🎯 ใช้ art กลางแบบเดียวกับหน้า scan
  const { data, info } = await sharp(filePath)
    .extract({
      left: 100,
      top: 180,
      width: 520,
      height: 520,
    })
    .resize(32, 32)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    cardNo,
    aHash: computeAHash([...data], info.width, info.height),
    dHash: computeAHash([...data], info.width, info.height),
    blocks: [...data].slice(0, 16),
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

  for (let i = 1; i <= 293; i++) {
    const cardNo = pad3(i);
    const filePath = await findCardFile(cardNo);
    if (!filePath) continue;

    const desc = await descriptorForFile(cardNo, filePath);
    output.push(desc);
    console.log(`OK ${cardNo}`);
  }

  await fs.writeFile(OUT_FILE, JSON.stringify(output));
  console.log(`DONE -> ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});