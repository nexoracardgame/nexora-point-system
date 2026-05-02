import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const sourceIcon = path.join(rootDir, "public", "icon-512.png");
const assetsDir = path.join(
  rootDir,
  "ios",
  "App",
  "App",
  "Assets.xcassets"
);
const appIconDir = path.join(assetsDir, "AppIcon.appiconset");
const splashDir = path.join(assetsDir, "Splash.imageset");
const brandDark = "#0B0A09";

async function appStoreIcon(source) {
  const logo = await sharp(source)
    .resize(760, 760, { fit: "contain" })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: brandDark,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

async function splash(source, size) {
  const logo = await sharp(source)
    .resize(980, 980, { fit: "contain" })
    .png()
    .toBuffer();
  const glow = await sharp({
    create: {
      width: 1500,
      height: 1500,
      channels: 4,
      background: { r: 246, g: 200, b: 95, alpha: 0.18 },
    },
  })
    .blur(220)
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
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

await mkdir(appIconDir, { recursive: true });
await mkdir(splashDir, { recursive: true });

await writeFile(
  path.join(appIconDir, "AppIcon-512@2x.png"),
  await appStoreIcon(source)
);

const splashImage = await splash(source, 2732);
await writeFile(path.join(splashDir, "splash-2732x2732.png"), splashImage);
await writeFile(path.join(splashDir, "splash-2732x2732-1.png"), splashImage);
await writeFile(path.join(splashDir, "splash-2732x2732-2.png"), splashImage);

console.log("Generated iOS App Store icon and splash assets");
