const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const source=fs.readFileSync('app/(main)/battle/triad-dominion/TriadDominionClient.tsx','utf8');
const ast=ts.createSourceFile('client.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=new Set(['CompactBattleBoard','BoardTriangle','BoardCardSlot','BoardPile','PhaseTrack','HandCard','laneForTurn','turnForLane','parseSkillTargetSelection']);
const extracted=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.has(n.name?.text)).map(n=>n.getText(ast)).join('\n');
const transpile=code=>ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const modules={};
for(const [id,pkg,file] of [['react','react','react.production.js'],['react/jsx-runtime','react','react-jsx-runtime.production.js'],['react-dom','react-dom','react-dom.production.js'],['react-dom/client','react-dom','react-dom-client.production.js'],['scheduler','scheduler','scheduler.production.js']])modules[id]=fs.readFileSync(path.join(path.dirname(require.resolve(pkg)),'cjs',file),'utf8');
modules['lucide-react']=fs.readFileSync(require.resolve('lucide-react'),'utf8');
modules.board=transpile(`import {useState,useLayoutEffect,useEffect,useRef,Fragment} from 'react';import {Sparkles} from 'lucide-react';
const playCardDeployment=()=>{window.deploySounds=(window.deploySounds||0)+1;return ()=>{};};
const TRIAD_CARD_BACK_SRC='/cards/card-backs/card-backs.png';
const Image=({fill,priority,quality,sizes,...props})=><img {...props} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>;
const MiniProfileHover=()=>null,CardHoverPreview=()=>null,RevealSpotlight=()=>null,SkillTargetOverlay=()=>null,TimeoutWarningOverlay=()=>null,BattleCinematic=()=>null;
const profileForParticipant=()=>null,getPlayableSkillTargetIds=()=>[];
${extracted}
export const TestHand=HandCard;export default CompactBattleBoard;`);
modules.arena=transpile(fs.readFileSync('lib/triad-arena.ts','utf8'));
const bundle=Object.entries(modules).map(([id,code])=>`${JSON.stringify(id)}:function(require,module,exports){${code}\n}`).join(',');
const css=fs.readdirSync('.next/static/chunks').filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync('.next/static/chunks/'+f,'utf8')).join('\n')+'\n'+fs.readFileSync('app/globals.css','utf8');
const html=`<!doctype html><html><head><meta charset="utf-8"><style>${css}body{margin:0;background:#080b0e}#root{position:relative!important;inset:auto!important;width:100%!important;height:100dvh!important;max-height:none!important;max-width:none!important;margin:0!important;padding:8px!important;box-sizing:border-box}@media(max-width:900px) and (orientation:portrait){#root{width:100dvh!important;height:100dvw!important;min-height:0!important}}</style></head><body><div id="root" class="nexora-battle-shell"></div><script>
const modules={${bundle}},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](require,m,m.exports);return m.exports;}
const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root')),Board=require('board').default;
const cards=Array.from({length:6},(_,i)=>({cardNo:String(i+1).padStart(3,'0'),name:'Card '+i,kind:'monster',sourceImage:'/cards/'+String(i+1).padStart(3,'0')+'.jpg'}));
const triangle={top:'001',left:'002',right:'003'},bot={top:'004',left:'005',right:'006'};
window.localPlayer=triangle;window.lockedPlayer=triangle;
window.mountHand=()=>root.render(React.createElement(require('board').TestHand,{card:cards[0],used:false,disabled:false,onClick:()=>window.handPlays=(window.handPlays||0)+1,onDropToLane:()=>{},onPreview:()=>window.previewOpen=true,onPreviewEnd:()=>window.previewOpen=false}));
window.mount=(id='wood')=>root.render(React.createElement(Board,{arena:require('arena').triadArenas.find(a=>a.id===id),battleSessionKey:'test',cardsByNo:new Map(cards.map(c=>[c.cardNo,c])),lockedFight:{player:window.lockedPlayer,bot,turns:[]},player:window.localPlayer,revealed:{1:{player:false,bot:!window.hideBot,scored:false},2:{player:false,bot:!window.hideBot,scored:false},3:{player:false,bot:!window.hideBot,scored:false}},activeTurn:1,matchScore:{player:1,bot:2},fightNo:1,fightScore:{player:0,bot:0},playerDeckLeft:17,botDeckLeft:17,playerGraveCards:[],botGraveCards:[],playerName:'ผู้เล่นทดสอบ',botName:'BOT Level.99',playerImage:'',botImage:'',placementLane:'top',timeLeft:90,battleActive:true,turnLocked:true,pendingSkillChoice:null,onSelectSkillTarget:()=>{},onConfirmSkillTarget:()=>{},onDrawRandomCard:()=>{},onSelectLane:()=>{},onPlaceCard:()=>{}}));mount();
</script></body></html>`;
(async()=>{
 fs.mkdirSync('artifacts/triad-arena',{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://arena.test/**',route=>{const url=new URL(route.request().url());if(url.pathname==='/')return route.fulfill({body:html,contentType:'text/html'});const asset=path.resolve('public','.'+url.pathname);if(!asset.startsWith(path.resolve('public')+path.sep))return route.abort();return route.fulfill({body:fs.readFileSync(asset),contentType:asset.endsWith('.webp')?'image/webp':'image/jpeg'});});
 for(const [width,height] of [[1440,900],[1920,1080],[390,650],[320,568],[844,390]]){
  await page.setViewportSize({width,height});await page.goto('https://arena.test/');await page.waitForSelector('[data-board-card]');await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
  const rects=await page.locator('[data-board-card]').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}));assert.equal(rects.length,6);
  assert.ok(await page.locator('[data-board-card]').evaluateAll(els=>els.every(el=>getComputedStyle(el).borderTopWidth==='0px'&&Math.abs(el.clientWidth/el.clientHeight-815/1110)<.02)),'Identical native card ratios without outer frames');
  const rotated=width<700;
  const local=await page.locator('.triad-arena-triangle').evaluateAll(els=>els.map(el=>{const main=el.querySelector('[data-triad-lane="top"]'),left=el.querySelector('[data-triad-lane="left"]');return {mainY:main.offsetTop,leftY:left.offsetTop,mainX:main.offsetLeft,leftX:left.offsetLeft}}));
  assert.ok(local[0].mainY>local[0].leftY,'Opponent pyramid points toward center');assert.ok(local[1].mainY<local[1].leftY,'Player monster is the pyramid apex');
  for(let i=0;i<6;i++){const r=rects[i];assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=width+1&&r.y+r.h<=height+1,`Card fits ${width}: ${JSON.stringify(r)}`);assert.ok((rotated?r.h:r.w)>=(width<700?28:height<500?50:130),`Readable cards ${width}: ${r.w}`);for(let j=0;j<i;j++){const b=rects[j];assert.ok(r.x+r.w<=b.x+1||b.x+b.w<=r.x+1||r.y+r.h<=b.y+1||b.y+b.h<=r.y+1,`Cards overlap ${width}`)}}
  const hud=await page.locator('.triad-board-phase-hud').boundingBox();
  assert.ok(rects.every(r=>rotated?r.x>=hud.x+hud.width-1:r.y+r.h<=hud.y+1),`Cards stay above HUD ${width}: ${JSON.stringify(hud)}`);
  assert.ok(hud.y+hud.height<=height,`HUD stays inside ${width}x${height}: ${JSON.stringify(hud)}`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`artifacts/triad-arena/board-${width}.png`});
 }
 await page.setViewportSize({width:1440,height:900});
 for(const id of ['fire','water','earth','wood','gold']){await page.evaluate(id=>mount(id),id);await page.waitForFunction(()=>document.querySelector('.triad-arena-background').complete);await page.screenshot({path:`artifacts/triad-arena/${id}.png`});}
 await page.evaluate(()=>{hideBot=true;mount('earth')});await page.waitForSelector('.triad-card-back-art');await page.waitForFunction(()=>[...document.images].every(i=>i.complete));await page.screenshot({path:'artifacts/triad-arena/native-card-back.png'});
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>{localPlayer={top:'',left:'',right:''};lockedPlayer={...localPlayer};deploySounds=0;mount()});
 await page.waitForFunction(()=>!document.querySelector('.triad-board-side-player [data-face-up="true"]'));
 await page.evaluate(()=>{localPlayer={top:'001',left:'',right:''};mount()});
 await page.waitForSelector('.triad-board-side-player [data-card-no="001"][data-face-up="true"]');
 await page.waitForTimeout(260);await page.screenshot({path:'artifacts/triad-arena/deployment-impact.png'});
 await page.evaluate(()=>{window.stableFace=document.querySelector('.triad-board-side-player .triad-card-face');window.faceFailures=0;window.observeFace=true;function track(){if(!observeFace)return;const face=document.querySelector('.triad-board-side-player [data-card-no="001"]');if(!face||face.dataset.faceUp!=='true'||getComputedStyle(face.querySelector('.triad-card-face')).opacity!=='1')faceFailures++;requestAnimationFrame(track)}track();});
 for(let i=0;i<8;i++){await page.evaluate(()=>mount());await page.waitForTimeout(100);}
 assert.ok(await page.evaluate(()=>stableFace===document.querySelector('.triad-board-side-player .triad-card-face')),'Polling retains the same face node');
 assert.equal(await page.evaluate(()=>deploySounds),1,'One placement sound, no replay on polling');
 assert.equal(await page.evaluate(()=>faceFailures),0,'Own card never hides or blinks during placement or stale locked snapshots');
 await page.evaluate(()=>{observeFace=false;localPlayer={top:'001',left:'002',right:'003'};mount()});
 await page.waitForTimeout(850);assert.equal(await page.locator('.triad-board-side-player [data-face-up="true"]').count(),3);
 await page.screenshot({path:'artifacts/triad-arena/deployment-settled.png'});
 await page.evaluate(()=>{handPlays=0;previewOpen=false;mountHand()});
 await page.locator('button').hover();assert.equal(await page.evaluate(()=>previewOpen),true);
 await page.locator('button').click();assert.equal(await page.evaluate(()=>handPlays),1);assert.equal(await page.evaluate(()=>previewOpen),false,'Playing closes preview without reopening it on pointer-up');
 assert.deepEqual(errors,[]);console.log('Arena UI: no overlaps, responsive terrain, face-up deployment, stale snapshots, stable DOM, no blinking, one sound and no preview flash on play passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
