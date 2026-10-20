const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-monsters.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle='))+'return modules;')(require);
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
modules.board=compile('components/HeptadArenaBoard.tsx');
modules['@/lib/heptad-rules']=compile('lib/heptad-rules.ts');
modules['./triad-dominion']=modules['@/lib/triad-dominion'];
modules['./game-monster-rating']=compile('lib/game-monster-rating.ts');
modules['@/lib/use-card-gesture']=compile('lib/use-card-gesture.ts');
modules['@/lib/pentad-dominion']='exports.pentadElementNames={earth:"ดิน",water:"น้ำ",wood:"ไม้",fire:"ไฟ",gold:"ทอง"};';
modules['./BattleArenaHud']=`exports.BattleArenaCardFrame=({children})=>require('react').createElement('span',{className:'nexora-card-art-frame'},children);`;
modules['./BattleCardInspector']=compile('components/BattleCardInspector.tsx');
for(const file of ['HeptadArenaBoard.css','BattleMobileOverlays.css','BattleCardInspector.css'])modules['./'+file]=' ';
const load=require('./game-collection-test-loader.cjs')();const real=load('lib/triad-dominion.ts');
modules['@/lib/triad-dominion']='exports.triadCardByNo=new Map('+JSON.stringify(real.triadCards.map(card=>[card.cardNo,card]))+');';
modules['./triad-dominion']=modules['@/lib/triad-dominion'];
const css=['components/HeptadArenaBoard.css','components/BattleCardGeometry.css','components/BattleHud.css','components/BattleMobileOverlays.css','components/BattleCardInspector.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n');
const cards=real.triadCards.filter(card=>card.kind==='monster').slice(0,14).map(card=>card.cardNo);
const board={host:Object.fromEntries(cards.slice(0,7).map((no,i)=>[i+1,no])),challenger:Object.fromEntries(cards.slice(7).map((no,i)=>[i+1,no]))};
const script=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}require('react-dom/client').createRoot(document.getElementById('root')).render(require('react').createElement(require('board').default,{board:${JSON.stringify(board)},names:{host:'ผู้เล่น A',challenger:'ผู้เล่น B'},activeTurn:4,playerSide:'host'}));`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('http://heptad.test/**',route=>{const url=new URL(route.request().url());if(url.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#101418;font-family:Arial}#root{position:fixed;inset:80px 8px 68px}${css}</style><div id="root"></div><script>${script}</script>`});return route.fulfill({body:fs.readFileSync('public'+url.pathname),contentType:'image/jpeg'});});
 for(const [width,height] of [[3840,2160],[1920,1080],[1366,768],[1024,600],[844,390],[667,375],[568,320]]){
  await page.setViewportSize({width,height});await page.goto('http://heptad.test/');await page.locator('.heptad-slot').first().waitFor();
  await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
  const boxes=await page.locator('.heptad-slot').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,turn:Number(node.dataset.turn)}}));
  assert.equal(boxes.length,14);
  for(let i=0;i<boxes.length;i++){const a=boxes[i];assert.ok(a.x>=0&&a.y>=80&&a.x+a.w<=width&&a.y+a.h<=height-67,'Card inside allocated field');assert.ok(Math.abs(a.w/a.h-815/1110)<.01);assert.ok(Math.abs(a.w-boxes[0].w)<1,'Equal card size both sides');for(let j=0;j<i;j++){const b=boxes[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'No overlapping cards');}}
  const left=boxes.slice(0,7);assert.ok(left[0].y<left[1].y&&left[1].y<left[2].y);assert.ok(left[5].x>left[6].x,'Support turn 6 right, 7 left');
  assert.deepEqual(errors,[]);fs.mkdirSync('artifacts/heptad-board',{recursive:true});await page.screenshot({path:`artifacts/heptad-board/${width}.png`});
  console.log(`HEPTAD ${width}x${height}: 14 equal cards, 1-2-4 formation, correct turn order and no overlaps`);
 }
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
