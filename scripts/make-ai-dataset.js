const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "../public/cards");
const outDir = path.join(__dirname, "../ai-dataset");

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

for (let i = 1; i <= 293; i++) {
  const cardNo = String(i).padStart(3, "0");
  const classDir = path.join(outDir, cardNo);

  if (!fs.existsSync(classDir)) fs.mkdirSync(classDir);

  const src = path.join(srcDir, `${cardNo}.jpg`);
  const dest = path.join(classDir, `${cardNo}.jpg`);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log("✔", cardNo);
  }
}

console.log("🔥 DATASET READY");