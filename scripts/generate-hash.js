const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

function getHashFromImage(img) {
  const canvas = createCanvas(8, 8);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(img, 0, 0, 8, 8);
  const data = ctx.getImageData(0, 0, 8, 8).data;

  let gray = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push((data[i] + data[i + 1] + data[i + 2]) / 3);
  }

  const avg = gray.reduce((a, b) => a + b, 0) / gray.length;

  return gray.map((v) => (v > avg ? "1" : "0")).join("");
}

async function run() {
  const cardsDir = path.join(__dirname, "../public/cards");
  const output = {};

  for (let i = 1; i <= 293; i++) {
    const cardNo = String(i).padStart(3, "0");
    const filePath = path.join(cardsDir, `${cardNo}.jpg`);

    try {
      const img = await loadImage(filePath);
      const hash = getHashFromImage(img);
      output[cardNo] = hash;

      console.log("✔", cardNo);
    } catch (err) {
      console.log("❌ missing", cardNo);
    }
  }

  fs.writeFileSync(
    path.join(__dirname, "../public/card-hashes.json"),
    JSON.stringify(output, null, 2)
  );

  console.log("🔥 DONE: card-hashes.json created");
}

run();