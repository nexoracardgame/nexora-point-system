const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-heptad-board.cjs','utf8');
const {modules,board,cards}=new Function('require',fixture.slice(0,fixture.indexOf('const script='))+'return {modules,board,cards};')(require);
modules.hand=ts.transpileModule(fs.readFileSync('components/HeptadSpecialHand.tsx','utf8'),{compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
const load=require('./game-collection-test-loader.cjs')();const skills=load('lib/triad-dominion.ts').triadCards.filter(c=>c.kind==='skill').slice(0,5).map(c=>c.cardNo);
const css=['components/HeptadArenaBoard.css','components/BattleCardGeometry.css','components/BattleHud.css','app/game/heptad/HeptadClient.css','components/HeptadSpecialHand.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n');
const script=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(id.endsWith('.css'))return {};if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}const R=require('react');window.chosen=0;function App(){const [prompt,setPrompt]=R.useState(false),[selected,setSelected]=R.useState('');window.setPrompt=setPrompt;return R.createElement('main',{className:'heptad-scene','data-heptad-phase':prompt?'special':'select'},R.createElement('div',{className:'heptad-field'},R.createElement(require('board').default,{board:${JSON.stringify(board)},names:{host:'Player',challenger:'Opponent'},activeTurn:2,playerSide:'host',specials:{host:selected?[{turn:2,no:'hidden',used:false}]:[],challenger:[]}})),R.createElement(require('hand').default,{cards:${JSON.stringify(skills)}.filter(no=>no!==selected),prompt,enabled:prompt&&!selected,message:'ต้องการใช้การ์ดเสริมพิเศษหรือไม่?',used:selected?1:0,limit:1,onChoose:no=>{chosen++;setSelected(no)},onDecline:()=>{},onPreview:()=>{},onPreviewEnd:()=>{}}))}require('react-dom/client').createRoot(document.getElementById('root')).render(R.createElement(App));`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const [width,height]of [[3840,2160],[1920,1080],[1366,768],[844,390],[667,375],[568,320]]){
  const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://special.test/**',route=>{const u=new URL(route.request().url());return u.pathname==='/'?route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><style>${css}</style><div id="root"></div><script>${script}</script>`}):route.fulfill({path:'public'+u.pathname})});
  await page.goto('http://special.test/');await page.locator('.heptad-slot').first().waitFor();
  const boxes=()=>page.locator('.heptad-slot').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}));const before=await boxes();
  assert.equal(await page.locator('.heptad-special-hand-card').count(),5);assert.ok(await page.locator('.heptad-special-hand-card img').evaluateAll(nodes=>nodes.every(node=>!node.src.includes('card-backs'))));
  await page.evaluate(()=>setPrompt(true));await page.getByRole('button',{name:'ไม่ใช้การ์ดเสริมพิเศษ',exact:true}).waitFor();assert.deepEqual(await boxes(),before,'Prompt never shifts or scales battlefield');
  assert.equal(await page.locator('.heptad-special-decision-arrow').count(),1);
  assert.equal(await page.locator('.heptad-special-hand').evaluate(node=>getComputedStyle(node,'::after').animationName),'special-hand-orbit');
  assert.ok(await page.locator('.heptad-special-hand-card').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node,'::after').animationName==='special-hand-orbit')));
  const tray=await page.locator('.heptad-special-hand').boundingBox();assert.ok(tray.x>=0&&tray.y>=48&&tray.x+tray.width<=width&&tray.y+tray.height<=height);
  for(const b of before)assert.ok(b.x+b.w<=tray.x||b.x>=tray.x+tray.width||b.y+b.h<=tray.y||b.y>=tray.y+tray.height,'Tray clears all 14 cards');
  await page.locator('.heptad-special-hand-card').last().dblclick();assert.equal(await page.evaluate(()=>chosen),1);assert.equal(await page.locator('.heptad-special-hand-card').count(),4);assert.equal(await page.locator('.heptad-field-special img').getAttribute('src'),'/cards/card-backs/card-backs.png');
  assert.equal(await page.locator('.heptad-special-decision-arrow').count(),0,'Decision arrow ends immediately after choosing');
  assert.equal(await page.locator('.heptad-special-hand').evaluate(node=>getComputedStyle(node,'::after').animationName),'none');
  assert.deepEqual(await boxes(),before,'Placing special card never moves battlefield');assert.deepEqual(errors,[]);
  fs.mkdirSync('artifacts/heptad-special-hand',{recursive:true});await page.screenshot({path:`artifacts/heptad-special-hand/${width}.png`});await page.close();console.log(`${width}x${height}: face-up persistent fan, no battlefield movement/overlap, double-click, 5→4 cards and facedown placement passed`);
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
