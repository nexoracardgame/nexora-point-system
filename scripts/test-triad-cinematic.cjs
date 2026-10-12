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
  '@/lib/triad-dominion': 'exports.triadSkillRuleByNo = new Map([["249", {target:"all",effects:[{metric:"support",delta:-3000}]}]]);',
  cinematic: compiled,
  './BattleParticles': ts.transpileModule(fs.readFileSync(dir + 'BattleParticles.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText,
  './BattleAudio': ts.transpileModule(fs.readFileSync(dir + 'BattleAudio.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText,
  './BattleTiming': ts.transpileModule(fs.readFileSync(dir + 'BattleTiming.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText,
};
const bundle = Object.entries(modules).map(([id, code]) => `${JSON.stringify(id)}:function(require,module,exports){${code}\n}`).join(',');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#090c0e;font-family:Arial,sans-serif}#root{position:relative;width:100%;height:100vh;min-height:480px}${fs.readFileSync(dir + 'BattleCinematic.module.css', 'utf8')}</style></head><body><div id="root"></div><script>
const modules={${bundle}},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](require,m,m.exports);return m.exports;}
const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root')),C=require('cinematic');
window.audioEvents=[];window.audioStops=0;
for(const method of ['createBufferSource','createOscillator']){const original=AudioContext.prototype[method];AudioContext.prototype[method]=function(...args){const source=original.apply(this,args),start=source.start.bind(source),stop=source.stop.bind(source),ctx=this;source.start=(when,...rest)=>{audioEvents.push({kind:method,when,now:ctx.currentTime,duration:source.buffer?.duration});return start(when,...rest)};source.stop=(...rest)=>{audioStops++;return stop(...rest)};return source;};}
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
      return route.fulfill({ body: fs.readFileSync(asset), contentType: asset.endsWith('.wav') ? 'audio/wav' : asset.endsWith('.png') ? 'image/png' : 'image/jpeg' });
    });
    for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390]]) {
      await page.setViewportSize({ width, height });
      await page.goto('https://cinematic.test/');
      await page.waitForSelector('[data-battle-cinematic]');
      assert.deepEqual(await page.evaluate(() => steps().filter(step=>step.kind==='strike').map(step => step.side)), ['opponent', 'player']);
      assert.equal(await page.locator('[data-hp-side="player"]').getAttribute('data-hp-value'), '8000');
      assert.equal(await page.locator('[data-hp-side="opponent"]').getAttribute('data-hp-value'), '6000');
      await page.waitForSelector('[data-kind="strike"]');
      await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
      await page.waitForFunction(() => {
        const c = document.querySelector('[data-battle-particles]');
        return c && c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0);
      });
      const cardSize = await page.locator('.card').first().evaluate(el => el.getBoundingClientRect().width);
      assert.ok(cardSize >= (height < 500 ? 75 : width > 700 ? 200 : 100), `Card must be large at ${width}x${height}: ${cardSize}`);
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = 1100; }
      });
      const hit = await page.evaluate(() => {
        const a = document.querySelector('.source').getBoundingClientRect();
        const b = document.querySelector('.target').getBoundingClientRect();
        return Math.abs((a.left + a.width / 2) - (b.left + b.width / 2));
      });
      assert.ok(hit < 60, `Cards must collide at ${width}px: ${hit}`);
      const pose = await page.locator('.source').evaluate(el => getComputedStyle(el).transform);
      await page.evaluate(() => { for (const a of document.getAnimations()) a.currentTime = 1200; });
      assert.equal(await page.locator('.source').evaluate(el => getComputedStyle(el).transform), pose, 'Card must hold its contact pose for hit-stop');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.goto('https://cinematic.test/');
      await page.waitForSelector('[data-battle-cinematic]');
      await page.waitForSelector('[data-kind="strike"]');
      await page.waitForTimeout(1250);
      const hpRects = await page.locator('.hpRow').evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width};});
      assert.ok(hpRects.top>=0&&hpRects.bottom<height&&hpRects.width<=width,'HP row must fit viewport');
      assert.ok(await page.evaluate(()=>document.querySelector('.number').getBoundingClientRect().bottom<=document.querySelector('.caption').getBoundingClientRect().top),'Damage number must not overlap the caption');
      await page.screenshot({ path: `artifacts/triad-cinematic/strike-${width}.png` });
      await page.locator('button[aria-label="ข้ามอนิเมชั่น"]').click();
      assert.equal(await page.evaluate(() => finished), 1);
    }
    await page.goto('https://cinematic.test/');
    // Repeated fresh server snapshots must not restart the playback timer.
    await page.evaluate(() => window.poll = setInterval(() => mount(), 180));
    await page.waitForFunction(() => finished === 1, { timeout: 18000 });
    await page.evaluate(() => clearInterval(window.poll));
    assert.equal(await page.evaluate(() => finished), 1);
    await page.evaluate(() => mount([{side:'player',cardNo:'249',summary:'ลดแต้มทั้งสองสนาม',type:'stat'}], 'skill'));
    await page.waitForSelector('.wave');
    assert.equal(await page.locator('[data-battle-cinematic]').getAttribute('data-effect'), 'debuff');
    await page.screenshot({ path: 'artifacts/triad-cinematic/field-skill.png' });
    await page.locator('input[type=checkbox]').check();
    await page.waitForFunction(() => finished === 2);
    await page.reload();
    await page.waitForSelector('.reduced');
    await page.waitForFunction(() => finished === 1);
    await page.locator('input[type=checkbox]').uncheck();
    // Each element must draw an actual, distinct impact rather than a color-only variant.
    for (const element of ['fire','water','wood','earth','gold']) {
      await page.evaluate(e => { player.element=e; opponent.element=e; mount([], 'element-'+e); }, element);
      await page.waitForSelector(`[data-element="${element}"]`);
      await page.waitForSelector('[data-kind="strike"]');
      await page.waitForTimeout(1260);
      assert.ok(await page.locator('[data-battle-particles]').evaluate(c => c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)));
      await page.screenshot({path:`artifacts/triad-cinematic/element-${element}.png`});
    }
    await page.evaluate(() => { result.winner='draw'; mount([], 'draw'); });
    await page.waitForSelector('.drawClash');
    assert.equal(await page.locator('.defeated').count(), 0);
    await page.evaluate(() => { result.winner='player'; mount([], 'winner'); });
    await page.waitForSelector('.winner');
    assert.equal(await page.locator('.winner.player').count(), 1);
    await page.evaluate(() => {
      result.turn=1;result.metric='total';result.prioritySide='player';result.playerTotal=10000;result.opponentTotal=12000;result.winner='opponent';mount([], 'hp-example');
    });
    await page.waitForFunction(()=>document.querySelector('[data-hp-side="player"]')?.dataset.hpValue==='10000'&&document.querySelector('[data-hp-side="opponent"]')?.dataset.hpValue==='12000');
    await page.waitForFunction(()=>document.querySelector('[data-hp-side="opponent"]')?.dataset.hpValue==='2000');
    assert.equal(await page.locator('[data-hp-side="player"]').getAttribute('data-hp-value'),'10000');
    await page.waitForFunction(()=>document.querySelector('[data-hp-side="player"]')?.dataset.hpValue==='-2000');
    await page.waitForFunction(()=>document.querySelector('[data-hp-side="player"] .hpValue')?.textContent.includes('-2,000'));
    assert.equal(await page.locator('[data-hp-side="opponent"]').getAttribute('data-hp-value'),'2000');
    assert.equal(await page.locator('[data-hp-side="player"] .hpFill').evaluate(el=>el.style.width),'0%');
    await page.screenshot({path:'artifacts/triad-cinematic/hp-counterattack.png'});
    // Sound must decode, schedule on contact, stop on mute/skip, and remember mute.
    await page.goto('https://cinematic.test/');
    await page.getByRole('button',{name:'เปิดเสียงการต่อสู้'}).click();
    await page.getByRole('button',{name:'ปิดเสียงการต่อสู้'}).waitFor();
    await page.waitForFunction(() => audioEvents.some(e=>e.kind==='createBufferSource'&&e.duration!==.32));
    const timing = await page.evaluate(() => audioEvents.filter(e=>e.kind==='createBufferSource'&&Math.abs(e.duration-.32)>.005));
    assert.ok(timing.some(e=>e.when-e.now>1&&e.when-e.now<1.2),'Impact clip must be scheduled at contact');
    await page.getByRole('button',{name:'ปิดเสียงการต่อสู้'}).click();
    const count = await page.evaluate(() => audioEvents.length);
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => audioEvents.length),count);
    assert.ok(await page.evaluate(() => audioStops>0));
    await page.reload();
    assert.equal(await page.evaluate(() => localStorage.getItem('triad-battle-muted')), '1');
    await page.getByRole('button',{name:'เปิดเสียงการต่อสู้'}).click();
    await page.waitForFunction(() => audioEvents.length>0);
    const stopsBeforeSkip = await page.evaluate(() => audioStops);
    await page.getByRole('button',{name:'ข้ามอนิเมชั่น'}).click();
    assert.ok(await page.evaluate(before => audioStops>before,stopsBeforeSkip));
    assert.deepEqual(errors, []);
    console.log('Cinematic: visible HP, slower playback, hit-stop, five elements, skill state, victory/draw, audio timing/mute/skip/persistence, responsive collision, polling, reduced motion passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
