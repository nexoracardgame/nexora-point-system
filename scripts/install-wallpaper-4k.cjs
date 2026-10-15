const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const sharp = require('sharp');
const { chromium } = require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const source = process.argv[2];
if (!source) throw Error('Pass the original MP4 path');
(async () => {
  const size = fs.statSync(source).size;
  const server = http.createServer((req, res) => {
    if (req.url !== '/video') { res.setHeader('Content-Type', 'text/html'); res.end('<video id="v" muted preload="auto" src="/video"></video>'); return; }
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
    const start = range ? Number(range[1]) : 0, end = range?.[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(range ? 206 : 200, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) });
    fs.createReadStream(source, { start, end }).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => v.readyState >= 2, { timeout: 60000 });
    const metadata = await page.evaluate(() => ({ width: v.videoWidth, height: v.videoHeight, duration: v.duration }));
    if (metadata.width !== 3840 || metadata.height !== 2160) throw Error('Original must be 3840x2160: '+JSON.stringify(metadata));
    const root = 'public/videos/nexora-home-4k'; fs.mkdirSync(root, { recursive: true });
    const poster = await page.evaluate(() => { const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);return c.toDataURL('image/png').split(',')[1]; });
    await sharp(Buffer.from(poster, 'base64')).webp({lossless:true}).toFile(path.join(root,'poster.webp'));
    const original = fs.readFileSync(source), chunkSize = 32 * 1024 * 1024, parts = [];
    for (let offset=0;offset<size;offset+=chunkSize) { const name=`part-${parts.length}.bin`;fs.writeFileSync(path.join(root,name),original.subarray(offset,offset+chunkSize));parts.push(name); }
    const hash = data => crypto.createHash('sha256').update(data).digest('hex');
    const reassembled=Buffer.concat(parts.map(part=>fs.readFileSync(path.join(root,part))));
    if(hash(original)!==hash(reassembled))throw Error('Byte verification failed');
    const manifest={...metadata,bytes:size,sha256:hash(original),parts};fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(manifest);
  } finally { await browser.close();server.closeAllConnections();server.close(); }
})();
