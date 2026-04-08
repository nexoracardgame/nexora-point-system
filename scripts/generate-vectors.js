const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

function getVector(img) {
  const w = img.width;
  const h = img.height;

  // 🎯 ครอปกลางเหมือนตอน scan
  const cropW = Math.floor(w * 0.6);
  const cropH = Math.floor(h * 0.75);
  const sx = Math.floor((w - cropW) / 2);
  const sy = Math.floor((h - cropH) / 2);

  const canvas = createCanvas(32, 48);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    img,
    sx,
    sy,
    cropW,
    cropH,
    0,
    0,
    32,
    48
  );

  const { data } = ctx.getImageData(0, 0, 32, 48);

  const vector = [];
  for (let i = 0; i < data.length; i += 4) {
    vector.push(
      Math.round((data[i] + data[i + 1] + data[i + 2]) / 3)
    );
  }

  return vector;
}

async function run() {
  const cardsDir = path.join(__dirname, "../public/cards");
  const output = {};

  for (let i = 1; i <= 293; i++) {
    const cardNo = String(i).padStart(3, "0");
    const filePath = path.join(cardsDir, `${cardNo}.jpg`);

    const img = await loadImage(filePath);
    output[cardNo] = getVector(img);

    console.log("✔", cardNo);
  }

  fs.writeFileSync(
    path.join(__dirname, "../public/card-vectors.json"),
    JSON.stringify(output)
  );

  console.log("🔥 DONE (FIXED VECTOR)");
}

run();