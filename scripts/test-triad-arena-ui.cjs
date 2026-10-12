const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const source=fs.readFileSync('app/(main)/battle/triad-dominion/TriadDominionClient.tsx','utf8');
const ast=ts.createSourceFile('client.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=new Set(['CompactBattleBoard','BoardTriangle','BoardCardSlot','BoardPile','PhaseTrack','laneForTurn','turnForLane','parseSkillTargetSelection']);
const extracted=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.has(n.name?.text)).map(n=>n.getText(ast)).join('\n');
const transpile=code=>ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const modules={};
for(const [id,pkg,file] of [['react','react','react.production.js'],['react/jsx-runtime','react','react-jsx-runtime.production.js'],['react-dom','react-dom','react-dom.production.js'],['react-dom/client','react-dom','react-dom-client.production.js'],['scheduler','scheduler','scheduler.production.js']])modules[id]=fs.readFileSync(path.join(path.dirname(require.resolve(pkg)),'cjs',file),'utf8');
modules['lucide-react']=fs.readFileSync(require.resolve('lucide-react'),'utf8');
modules.board=transpile(`import {useState,useLayoutEffect,Fragment} from 'react';import {Sparkles} from 'lucide-react';
const TRIAD_CARD_BACK_SRC='/cards/card-backs/card-backs.png';
const Image=({fill,priority,quality,sizes,...props})=><img {...props} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>;
const MiniProfileHover=()=>null,CardHoverPreview=()=>null,RevealSpotlight=()=>null,SkillTargetOverlay=()=>null,TimeoutWarningOverlay=()=>null,BattleCinematic=()=>null;
const profileForParticipant=()=>null,getPlayableSkillTargetIds=()=>[];
${extracted}
export default CompactBattleBoard;`);
modules.arena=transpile(fs.readFileSync('lib/triad-arena.ts','utf8'));
const bundle=Object.entries(modules).map(([id,code])=>`${JSON.stringify(id)}:function(require,module,exports){${code}\n}`).join(',');
const css=fs.readdirSync('.next/static/chunks').filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync('.next/static/chunks/'+f,'utf8')).join('\n');
const html=`<!doctype html><html><head><meta charset="utf-8"><style>${css}body{margin:0;background:#080b0e}#root{position:relative!important;inset:auto!important;width:100%!important;height:100dvh!important;max-height:none!important;max-width:none!important;margin:0!important;padding:8px!important;box-sizing:border-box}@media(max-width:900px) and (orientation:portrait){#root{width:100dvh!important;height:100dvw!important;min-height:0!important}}</style></head><body><div id="root" class="nexora-battle-shell"></div><script>
const modules={${bundle}},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](require,m,m.exports);return m.exports;}
const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root')),Board=require('board').default;
const cards=Array.from({length:6},(_,i)=>({cardNo:String(i+1).padStart(3,'0'),name:'Card '+i,kind:'monster',sourceImage:'/cards/'+String(i+1).padStart(3,'0')+'.jpg'}));
const triangle={top:'001',left:'002',right:'003'},bot={top:'004',left:'005',right:'006'};
window.mount=(id='wood')=>root.render(React.createElement(Board,{arena:require('arena').triadArenas.find(a=>a.id===id),battleSessionKey:'test',cardsByNo:new Map(cards.map(c=>[c.cardNo,c])),lockedFight:{player:triangle,bot,turns:[]},player:triangle,revealed:{1:{player:true,bot:true,scored:false},2:{player:true,bot:true,scored:false},3:{player:true,bot:true,scored:false}},activeTurn:1,matchScore:{player:1,bot:2},fightNo:1,fightScore:{player:0,bot:0},playerDeckLeft:17,botDeckLeft:17,playerGraveCards:[],botGraveCards:[],playerName:'ผู้เล่นทดสอบ',botName:'BOT Level.99',playerImage:'',botImage:'',placementLane:'top',timeLeft:90,battleActive:true,turnLocked:true,pendingSkillChoice:null,onSelectSkillTarget:()=>{},onConfirmSkillTarget:()=>{},onDrawRandomCard:()=>{},onSelectLane:()=>{},onPlaceCard:()=>{}}));mount();
</script></body></html>`;
(async()=>{
 fs.mkdirSync('artifacts/triad-arena',{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://arena.test/**',route=>{const url=new URL(route.request().url());if(url.pathname==='/')return route.fulfill({body:html,contentType:'text/html'});const asset=path.resolve('public','.'+url.pathname);if(!asset.startsWith(path.resolve('public')+path.sep))return route.abort();return route.fulfill({body:fs.readFileSync(asset),contentType:asset.endsWith('.webp')?'image/webp':'image/jpeg'});});
 for(const [width,height] of [[1440,900],[1920,1080],[390,650],[320,568],[844,390]]){
  await page.setViewportSize({width,height});await page.goto('https://arena.test/');await page.waitForSelector('[data-board-card]');await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
  const rects=await page.locator('[data-board-card]').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}));assert.equal(rects.length,6);
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
 assert.deepEqual(errors,[]);console.log('Arena UI: NEXORA pyramid apexes, six cards, no overlaps, desktop/mobile landscape rotation, HUD bounds and five terrain images passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
