const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { chromium } = require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const source = fs.readFileSync(process.env.TRIAD_CLIENT_SOURCE || 'app/(main)/battle/triad-dominion/TriadDominionClient.tsx', 'utf8');
const ast = ts.createSourceFile('client.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const compile = code => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const readiness = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'roomDecksReadyForBattle');
assert.ok(readiness);
const readinessContext = vm.createContext({});
vm.runInContext(compile(readiness.getText(ast)), readinessContext);
for (const deckMode of ['all', 'monster', 'skill']) {
  readinessContext.room = {game:{deckMode,deckReady:{host:true,challenger:true},decks:{host:['001'],challenger:[]}}};
  assert.equal(vm.runInContext('roomDecksReadyForBattle(room)',readinessContext),true,'Server-ready concealed deck starts '+deckMode);
  readinessContext.room.game.deckReady.challenger=false;
  assert.equal(vm.runInContext('roomDecksReadyForBattle(room)',readinessContext),false,'Never start before both ready');
}
assert.ok(source.includes('currentRoom ? bothDecksReady : phase === "battle"'),'Solo Triad also opens the shared VS scene');
let deckEffect;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0]?.getText(ast).includes('const sessionKey =')) deckEffect = node.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(deckEffect);
let selected = [];
let resets = 0;
const state = {
  roomPlayerSide: 'host', opponentSide: 'challenger', phase: 'deck', ownDeckReady: false,
  localDeckSessionRef: { current: '' },
  roomBattleStartKey: room => `${room.code}:${room.game.deckStartedAt}`,
  roomDecksReadyForBattle: () => false, hasBattleStartedForRoom: () => false,
  roomDeckSecondsLeft: () => 300, TURN_SECONDS: 120,
  resetLocalDeckSelectionState: () => { selected = []; resets++; },
  setPlayerDeck: deck => { selected = [...deck]; },
};
for (const setter of new Set(deckEffect.match(/\bset[A-Z]\w+/g))) state[setter] ||= () => {};
const context = vm.createContext(state);
vm.runInContext(compile(`const syncDeck = ${deckEffect};`), context);
context.currentRoom = { code: 'room', game: { deckStartedAt: 100, decks: { host: [], challenger: [] } } };
vm.runInContext('syncDeck()', context);
selected = ['007', '008'];
for (let i = 0; i < 10; i++) vm.runInContext('syncDeck()', context);
assert.deepEqual(selected, ['007', '008']);
assert.equal(resets, 1);
context.currentRoom = { code: 'room', game: { deckStartedAt: 101, decks: { host: [], challenger: [] } } };
vm.runInContext('syncDeck()', context);
assert.deepEqual(selected, []);
assert.equal(resets, 2);
selected = ['009'];
vm.runInContext('syncDeck()', context);
assert.deepEqual(selected, ['009']);
// A reconnect restores only the current server draft, without repeating hydration.
context.currentRoom = { code: 'other', game: { deckStartedAt: 102, decks: { host: ['010'], challenger: [] } } };
vm.runInContext('syncDeck()', context);
assert.deepEqual(selected, ['010']);

const names = new Set(['rpsIcon', 'OpeningTieBreakOverlay', 'OpeningTieBreakResultOverlay', 'SkillTargetOverlay', 'parseSkillTargetSelection', 'nextTwoStepTargetSelection', 'isTwoStepTargetSkill']);
const parts = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text)).map(node => node.getText(ast));
const labels = ast.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(ast) === 'rpsLabel'));
const component = compile(`const {createPortal}=require('react-dom'); const {useEffect,useState,useRef}=require('react'); const {Hand,Scissors,Swords,Trophy,Loader2,RotateCcw,Clock3,Shield,Check}=require('lucide-react'); const triadCardByNo=new Map([['225',{cardNo:'225',name:'Earth Rebirth',skillText:'เลือกมอนสเตอร์บนสนามเรา 1 ใบ',sourceImage:'/cards/225.jpg',attack:0,support:0}],['268',{cardNo:'268',name:'Blazecurse',skillText:'มอนสเตอร์ธาตุไฟไม่สามารถใช้ค่า ATTACK',sourceImage:'/cards/268.jpg',attack:0,support:0}]]); const getPlayableSkillTargetIds=card=>card?.cardNo==='245'?['copy:225','copy:268']:window.twoTargets?['player-top','bot-top']:['player-top'];\n${labels.getText(ast)}\n${parts.join('\n')}\nexports.Choose=OpeningTieBreakOverlay; exports.Result=OpeningTieBreakResultOverlay; exports.Target=SkillTargetOverlay;`);
const modules = {};
for (const [id, pkg, file] of [
  ['react', 'react', 'react.production.js'], ['react/jsx-runtime', 'react', 'react-jsx-runtime.production.js'],
  ['react-dom', 'react-dom', 'react-dom.production.js'], ['react-dom/client', 'react-dom', 'react-dom-client.production.js'],
  ['scheduler', 'scheduler', 'scheduler.production.js'],
]) modules[id] = fs.readFileSync(path.join(path.dirname(require.resolve(pkg)), 'cjs', file), 'utf8');
modules['lucide-react'] = fs.readFileSync(require.resolve('lucide-react'), 'utf8');
modules['@/lib/target-selection-view'] = compile(fs.readFileSync('lib/target-selection-view.ts', 'utf8'));
modules['target-modal'] = compile(fs.readFileSync('components/TargetSelectionModal.tsx', 'utf8'));
modules['./TargetSelectionModal.css'] = '';
modules['./BattleMobileOverlays.css'] = '';
modules['rps-shared'] = 'exports.default=require("target-modal").default;';
modules.rps = "const TargetSelectionModal=require('rps-shared').default;\n" + component;
const bundle = Object.entries(modules).map(([id, code]) => `${JSON.stringify(id)}:function(require,module,exports){${code}\n}`).join(',');
const cssFiles = [];
function collect(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, entry.name); if (entry.isDirectory()) collect(p); else if (p.endsWith('.css')) cssFiles.push(p); } }
collect('.next/static');
const css = cssFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n') + '\n' + fs.readFileSync('components/TargetSelectionModal.css', 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div style="transform:translateZ(0);height:100px;overflow:hidden" id="root"></div><div class="nexora-battle-preview-portal" style="position:fixed;inset:0;background:red">Card preview</div><script>
const modules={${bundle}},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](require,m,m.exports);return m.exports;}
const React=require('react'),R=require('rps'),root=require('react-dom/client').createRoot(document.getElementById('root'));
window.chosen='';window.mount=(round=1,resolved=false)=>{root.render(React.createElement(React.Fragment,null,React.createElement(R.Choose,{tieBreak:{status:resolved?'resolved':'waiting',round,choices:{},winner:resolved?'host':''},hostName:'ผู้เล่นหนึ่ง',challengerName:'ผู้เล่นสอง',ownSide:'host',isSpectator:false,pendingChoice:null,onChoose:c=>window.chosen=c,onReset:()=>{}}),React.createElement(R.Result,{tieBreak:{status:'resolved',winner:'host',choices:{host:'rock',challenger:'scissors'}},hostName:'ผู้เล่นหนึ่ง',challengerName:'ผู้เล่นสอง',visible:resolved}))) };mount();
window.twoTargets=false; window.requests=0; window.fail=true; window.targetTime=28;
function Target(){const [selected,setSelected]=React.useState('');return React.createElement(R.Target,{card:{cardNo:window.copyMode?'245':window.twoTargets?'232':'235',name:'ตราผนึกหิน',skillText:'เลือกมอนสเตอร์บนสนามเรา 1 ใบ เพิ่ม ATTACK +2000 และ SUPPORT +2000 จนจบตา'},side:'player',playerTop:{sourceImage:'/cards/007.jpg',name:'มอนสเตอร์หลักเรา',attack:6700,support:3200},botTop:{sourceImage:'/cards/008.jpg',name:'มอนสเตอร์คู่แข่ง',attack:6000,support:2000},selectedTarget:selected,timeLeft:window.targetTime,onSelect:setSelected,onConfirm:async()=>{window.requests++;await new Promise(r=>setTimeout(r,300));if(window.fail)throw Error('network');root.render(null);}})}
window.mountTarget=(two=false,time=28)=>{window.copyMode=false;window.twoTargets=two;window.targetTime=time;root.render(React.createElement(Target,{key:two+':'+time}));};
window.mountCopy=()=>{window.copyMode=true;window.twoTargets=false;root.render(React.createElement(Target,{key:'copy'}));};
</script></body></html>`;
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.route('https://selection.test/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({ body: html, contentType: 'text/html' });
      const asset = path.resolve('public', '.' + url.pathname);
      if (!asset.startsWith(path.resolve('public') + path.sep)) return route.abort();
      return route.fulfill({ body: fs.readFileSync(asset), contentType: 'image/jpeg' });
    });
    fs.mkdirSync('artifacts/triad-selection', { recursive: true });
    for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
      await page.setViewportSize({ width, height });
      await page.goto('https://selection.test/');
      const button = page.getByRole('button', { name: 'ค้อน', exact: true });
      await button.waitFor();
      assert.equal(await button.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true);
      await button.click();
      assert.equal(await page.evaluate(() => chosen), 'rock');
      await page.evaluate(() => mount(2));
      await page.getByRole('button', { name: 'กระดาษ', exact: true }).click();
      assert.equal(await page.evaluate(() => chosen), 'paper');
      await page.screenshot({ path: `artifacts/triad-selection/rps-${width}.png` });
      await page.evaluate(() => mount(2, true));
      await page.locator('.triad-tiebreak-result-panel').waitFor();
      assert.equal(await page.locator('.triad-tiebreak-result-panel').evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true);
      await page.evaluate(() => mountTarget());
      const confirm = page.getByRole('button', { name: 'ยืนยันเป้าหมาย', exact: true });
      await confirm.waitFor();
      await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
      assert.equal(await page.locator('.nexora-target-option').count(), 1);
      assert.equal(await confirm.isEnabled(), true);
      await page.locator('.nexora-target-overlay').evaluate(async el => { await Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished)); });
      assert.equal(await confirm.evaluate(el => { const r = el.getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true);
      await page.screenshot({ path: `artifacts/triad-selection/target-${width}.png` });
      await confirm.click();
      await page.getByRole('alert').waitFor();
      assert.equal(await confirm.isEnabled(), true);
      assert.equal(await page.evaluate(() => requests), 1);
      await page.evaluate(() => window.fail = false);
      await confirm.click();
      await page.locator('.nexora-target-overlay').waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => requests), 2);
      await page.evaluate(() => mountTarget(true));
      await confirm.waitFor();
      assert.equal(await confirm.isEnabled(), false);
      const options = page.locator('.nexora-target-option');
      await options.nth(0).click();
      assert.equal(await confirm.isEnabled(), false);
      await options.nth(1).click();
      assert.equal(await confirm.isEnabled(), true);
      await page.evaluate(() => mountTarget(false, 0));
      await page.getByRole('button', { name: 'หมดเวลา กำลังดำเนินต่อ' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'หมดเวลา กำลังดำเนินต่อ' }).isEnabled(), false);
    }
    await page.evaluate(()=>{window.fail=false;window.requests=0;window.targetTime=28;mountCopy()});
    await page.locator('.nexora-target-option').first().click();await page.getByRole('button',{name:'ยืนยันเป้าหมาย',exact:true}).click();
    await page.getByText('มอนสเตอร์หลักเรา',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>requests),0,'245 first confirms a source, not the whole skill');
    await page.getByRole('button',{name:'ยืนยันเป้าหมาย',exact:true}).click();await page.locator('.nexora-target-overlay').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>requests),1,'245 confirms the copied skill target in a second step');
    assert.deepEqual(errors, []);
    console.log('Selection UI: draft polling/reset/reconnect, RPS layering, target auto-select, two-step, network retry, deadline and visible confirm on desktop/mobile/landscape passed');
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
