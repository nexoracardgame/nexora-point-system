import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const sourceIcon = path.join(rootDir, "public", "icon-512.png");
const assetsDir = path.join(rootDir, "desktop", "assets");
const iconPath = path.join(assetsDir, "icon.ico");
const iconSizes = [16, 24, 32, 48, 64, 128, 256];

function createIcoBuffer(images) {
  const headerSize = 6;
  const directorySize = 16 * images.length;
  let imageOffset = headerSize + directorySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(directorySize);
  const imageBuffers = [];

  images.forEach(({ size, buffer }, index) => {
    const entryOffset = index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, entryOffset);
    directory.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);
    directory.writeUInt8(0, entryOffset + 2);
    directory.writeUInt8(0, entryOffset + 3);
    directory.writeUInt16LE(1, entryOffset + 4);
    directory.writeUInt16LE(32, entryOffset + 6);
    directory.writeUInt32LE(buffer.length, entryOffset + 8);
    directory.writeUInt32LE(imageOffset, entryOffset + 12);

    imageBuffers.push(buffer);
    imageOffset += buffer.length;
  });

  return Buffer.concat([header, directory, ...imageBuffers]);
}

await mkdir(assetsDir, { recursive: true });

const source = await readFile(sourceIcon);
const images = await Promise.all(
  iconSizes.map(async (size) => ({
    size,
    buffer: await sharp(source)
      .resize(size, size, { fit: "cover" })
      .png()
      .toBuffer(),
  }))
);

await writeFile(iconPath, createIcoBuffer(images));
console.log(`Generated ${path.relative(rootDir, iconPath)}`);
