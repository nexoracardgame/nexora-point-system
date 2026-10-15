const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const root = 'artifacts/mode-ui-v3/NEXORA_Codex_Mode_UI_V3_COMPLETE/assets';
(async () => {
  const files = fs.readdirSync(root, { recursive: true }).filter(file => /\.(png|webp)$/.test(file));
  const tiles = [], report = [];
  for (const [i, file] of files.entries()) {
    const source = path.join(root, file), metadata = await sharp(source).metadata(), stats = await sharp(source).stats();
    report.push({ file, width: metadata.width, height: metadata.height, alpha: metadata.hasAlpha, opaque: stats.isOpaque });
    tiles.push({ input: await sharp(source).resize(220, 140, { fit: 'inside' }).png().toBuffer(), left: i % 5 * 240 + 10, top: Math.floor(i / 5) * 180 + 10 });
    tiles.push({ input: Buffer.from(`<svg width="235" height="25"><text x="5" y="16" fill="white" font-size="11">${file}</text></svg>`), left: i % 5 * 240, top: Math.floor(i / 5) * 180 + 150 });
  }
  await sharp({ create: { width: 1200, height: Math.ceil(files.length / 5) * 180, channels: 4, background: '#344451' } }).composite(tiles).png().toFile('artifacts/mode-ui-v3/contact.png');
  fs.writeFileSync('artifacts/mode-ui-v3/audit.json', JSON.stringify(report, null, 2));
  console.log(report);
})();
