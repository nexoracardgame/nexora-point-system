const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

// Convert the licensed source clips to mono PCM WAV for mobile browser support.
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const dir = path.resolve('public/battle-fx/audio');
    const sourceDir = path.resolve(process.argv[2] || 'artifacts/triad-audio-source');
    await page.route('https://audio.test/**', route => {
      const name = new URL(route.request().url()).pathname.slice(1);
      if (!name) return route.fulfill({ body: '<html></html>', contentType: 'text/html' });
      return route.fulfill({ body: fs.readFileSync(path.join(sourceDir, path.basename(name))), contentType: 'audio/ogg' });
    });
    await page.goto('https://audio.test/');
    for (const file of fs.readdirSync(sourceDir).filter(name => name.endsWith('.ogg'))) {
      const samples = await page.evaluate(async name => {
        const audio = new AudioContext();
        try {
          const clip = await audio.decodeAudioData(await (await fetch('/' + name)).arrayBuffer());
          const renderer = new OfflineAudioContext(1, Math.ceil(Math.min(clip.duration, 1.2) * 22050), 22050);
          const source = renderer.createBufferSource();
          source.buffer = clip;
          source.connect(renderer.destination);
          source.start();
          return Array.from((await renderer.startRendering()).getChannelData(0));
        } finally { await audio.close(); }
      }, file);
      const wav = Buffer.alloc(44 + samples.length * 2);
      wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
      wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
      wav.writeUInt32LE(22050, 24); wav.writeUInt32LE(44100, 28); wav.writeUInt16LE(2, 32);
      wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
      samples.forEach((sample, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + i * 2));
      fs.writeFileSync(path.join(dir, file.replace('.ogg', '.wav')), wav);
    }
    console.log('Converted impact clips to mono WAV');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
