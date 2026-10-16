const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const code = ts.transpileModule(fs.readFileSync('lib/game-window-mode.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
(async () => {
 const browser = await chromium.launch({ channel: 'chrome', headless: true });
 try {
  for (const bridge of ['absent', 'unsupported', 'rejected', 'native']) {
   const page = await browser.newPage();
   await page.route('http://window.test/**', r => r.fulfill({ contentType: 'text/html', body: '<button id="full">Fullscreen</button><button id="window">Windowed</button>' }));
   await page.goto('http://window.test/');
   await page.evaluate(({ code, bridge }) => {
    const exports = {};
    new Function('exports', code)(exports);
    window.modeErrors = [];
    if (bridge !== 'absent') window.nexoraDesktop = { windowControl: async () => {
     await new Promise(resolve => setTimeout(resolve, 150));
     if (bridge === 'rejected') throw new Error('Old IPC');
     return bridge === 'native';
    } };
    document.querySelector('#full').onclick = () => exports.setGameWindowMode('fullscreen').catch(e => window.modeErrors.push(e.message));
    document.querySelector('#window').onclick = () => exports.setGameWindowMode('windowed').catch(e => window.modeErrors.push(e.message));
   }, { code, bridge });
   await page.click('#full');
   await page.waitForFunction(() => document.fullscreenElement && document.documentElement.dataset.gameWindowMode === 'fullscreen');
   await page.click('#window');
   await page.waitForFunction(() => !document.fullscreenElement && document.documentElement.dataset.gameWindowMode === 'windowed');
   assert.deepEqual(await page.evaluate(() => window.modeErrors), []);
   console.log(`Fullscreen/windowed: ${bridge} bridge passed`);
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
