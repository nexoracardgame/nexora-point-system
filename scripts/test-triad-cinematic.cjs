const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { chromium } = require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir = 'app/(main)/battle/triad-dominion/';
const compiled = ts.transpileModule(fs.readFileSync(dir + 'BattleCinematic.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const reactDir = path.dirname(require.resolve('react'));
const domDir = path.dirname(require.resolve('react-dom'));
const schedulerDir = path.dirname(require.resolve('scheduler'));
const modules = {
  react: fs.readFileSync(path.join(reactDir, 'cjs/react.production.js'), 'utf8'),
  'react/jsx-runtime': fs.readFileSync(path.join(reactDir, 'cjs/react-jsx-runtime.production.js'), 'utf8'),
  'react-dom': fs.readFileSync(path.join(domDir, 'cjs/react-dom.production.js'), 'utf8'),
  'react-dom/client': fs.readFileSync(path.join(domDir, 'cjs/react-dom-client.production.js'), 'utf8'),
  scheduler: fs.readFileSync(path.join(schedulerDir, 'cjs/scheduler.production.js'), 'utf8'),
  'lucide-react': fs.readFileSync(require.resolve('lucide-react'), 'utf8'),
  './BattleCinematic.module.css': 'exports.default = new Proxy({}, { get: (_, key) => key });',
  '@/lib/triad-dominion': 'exports.triadSkillRuleByNo = new Map([["249", {target:"all"}]]);',
  cinematic: compiled,
};
const bundle = Object.entries(modules).map(([id, code]) => `${JSON.stringify(id)}:function(require,module,exports){${code}\n}`).join(',');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#090c0e;font-family:Arial,sans-serif}#root{position:relative;width:100%;height:100vh;min-height:480px}${fs.readFileSync(dir + 'BattleCinematic.module.css', 'utf8')}</style></head><body><div id="root"></div><script>
const modules={${bundle}},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](require,m,m.exports);return m.exports;}
const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root')),C=require('cinematic');
window.player={cardNo:'007',name:'Fire Warrior',element:'fire',kind:'monster',sourceImage:'/cards/007.jpg',attack:8000,support:2000};
window.opponent={cardNo:'008',name:'Water Guardian',element:'water',kind:'monster',sourceImage:'/cards/008.jpg',attack:6000,support:3000};
window.result={turn:2,prioritySide:'opponent',metric:'attack',playerTotal:8000,opponentTotal:6000,winner:'player',skillEvents:[]};
window.finished=0;window.mount=(events=[], key='battle')=>{window.result.skillEvents=events;root.render(React.createElement(C.default,{key,result:JSON.parse(JSON.stringify(window.result)),playerCard:window.player,opponentCard:window.opponent,cardsByNo:new Map([['007',window.player],['008',window.opponent],['249',{...window.opponent,cardNo:'249',name:'Veil of Mist',kind:'skill'}]]),playerName:'ผู้เล่นฝ่ายหนึ่ง',opponentName:'ผู้เล่นฝ่ายสอง',onComplete:()=>{window.finished++}}))};
window.steps=()=>C.buildBattleSteps(window.result,window.player,window.opponent);window.mount();
</script></body></html>`;
(async () => {
  fs.mkdirSync('artifacts/triad-cinematic', { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://cinematic.test/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({ body: html, contentType: 'text/html' });
      const asset = path.resolve('public', '.' + url.pathname);
      if (!asset.startsWith(path.resolve('public') + path.sep)) return route.abort();
      return route.fulfill({ body: fs.readFileSync(asset), contentType: 'image/jpeg' });
    });
    for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
      await page.setViewportSize({ width, height });
      await page.goto('https://cinematic.test/');
      await page.waitForSelector('[data-battle-cinematic]');
      assert.deepEqual(await page.evaluate(() => steps().map(step => step.side)), ['opponent', 'player', 'player']);
      await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = 520; }
      });
      const hit = await page.evaluate(() => {
        const a = document.querySelector('.source').getBoundingClientRect();
        const b = document.querySelector('.target').getBoundingClientRect();
        return Math.abs((a.left + a.width / 2) - (b.left + b.width / 2));
      });
      assert.ok(hit < 60, `Cards must collide at ${width}px: ${hit}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `artifacts/triad-cinematic/strike-${width}.png` });
      await page.locator('button[aria-label="ข้ามอนิเมชั่น"]').click();
      assert.equal(await page.evaluate(() => finished), 1);
    }
    await page.goto('https://cinematic.test/');
    // Repeated fresh server snapshots must not restart the playback timer.
    await page.evaluate(() => window.poll = setInterval(() => mount(), 180));
    await page.waitForFunction(() => finished === 1, { timeout: 6000 });
    await page.evaluate(() => clearInterval(window.poll));
    assert.equal(await page.evaluate(() => finished), 1);
    await page.evaluate(() => mount([{side:'player',cardNo:'249',summary:'ลดแต้มทั้งสองสนาม',type:'stat'}], 'skill'));
    await page.waitForSelector('.wave');
    await page.screenshot({ path: 'artifacts/triad-cinematic/field-skill.png' });
    await page.locator('input[type=checkbox]').check();
    await page.waitForFunction(() => finished === 2);
    await page.reload();
    await page.waitForSelector('.reduced');
    await page.waitForFunction(() => finished === 1);
    assert.deepEqual(errors, []);
    console.log('Cinematic: desktop/mobile collision, assets, skip, server polling, field skill, reduced motion passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
