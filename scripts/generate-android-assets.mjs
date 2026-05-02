import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const sourceIcon = path.join(rootDir, "public", "icon-512.png");
const resDir = path.join(rootDir, "android", "app", "src", "main", "res");
const brandDark = "#0B0A09";
const brandGold = "#F6C85F";

const iconDensities = [
  ["mipmap-mdpi", 48, 108],
  ["mipmap-hdpi", 72, 162],
  ["mipmap-xhdpi", 96, 216],
  ["mipmap-xxhdpi", 144, 324],
  ["mipmap-xxxhdpi", 192, 432],
];

function circleMask(size) {
  return Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  );
}

async function logoBuffer(source, size, ratio) {
  const logoSize = Math.round(size * ratio);
  return sharp(source)
    .resize(logoSize, logoSize, { fit: "contain" })
    .png()
    .toBuffer();
}

async function launcherIcon(source, size, round = false) {
  const logo = await logoBuffer(source, size, 0.74);
  let image = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: brandDark,
    },
  }).composite([{ input: logo, gravity: "center" }]);

  if (round) {
    image = image.composite([{ input: circleMask(size), blend: "dest-in" }]);
  }

  return image.png().toBuffer();
}

async function adaptiveForeground(source, size) {
  const logo = await logoBuffer(source, size, 0.62);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

async function splash(source, width, height) {
  const logo = await logoBuffer(source, Math.min(width, height), 0.34);
  const glowSize = Math.round(Math.min(width, height) * 0.58);
  const glow = await sharp({
    create: {
      width: glowSize,
      height: glowSize,
      channels: 4,
      background: { r: 246, g: 200, b: 95, alpha: 0.2 },
    },
  })
    .blur(Math.round(glowSize * 0.18))
    .png()
    .toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: brandDark,
    },
  })
    .composite([
      { input: glow, gravity: "center" },
      { input: logo, gravity: "center" },
    ])
    .png()
    .toBuffer();
}

const source = await readFile(sourceIcon);

for (const [directory, iconSize, foregroundSize] of iconDensities) {
  const targetDir = path.join(resDir, directory);
  await mkdir(targetDir, { recursive: true });
  await writeFile(
    path.join(targetDir, "ic_launcher.png"),
    await launcherIcon(source, iconSize)
  );
  await writeFile(
    path.join(targetDir, "ic_launcher_round.png"),
    await launcherIcon(source, iconSize, true)
  );
  await writeFile(
    path.join(targetDir, "ic_launcher_foreground.png"),
    await adaptiveForeground(source, foregroundSize)
  );
}

for (const directory of await readdir(resDir)) {
  if (!directory.startsWith("drawable")) continue;

  const filePath = path.join(resDir, directory, "splash.png");
  const metadata = await sharp(filePath).metadata().catch(() => null);
  if (!metadata?.width || !metadata?.height) continue;

  await writeFile(filePath, await splash(source, metadata.width, metadata.height));
}

await writeFile(
  path.join(resDir, "values", "colors.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="colorPrimary">${brandDark}</color>\n    <color name="colorPrimaryDark">#050505</color>\n    <color name="colorAccent">${brandGold}</color>\n</resources>\n`
);

await writeFile(
  path.join(resDir, "values", "ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${brandDark}</color>\n</resources>\n`
);

console.log("Generated Android launcher and splash assets");
