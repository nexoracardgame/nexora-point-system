const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), assert = require('node:assert/strict');
const {chromium} = require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const source = fs.readFileSync(process.env.TRIAD_CLIENT_SOURCE || 'app/(main)/battle/triad-dominion/TriadDominionClient.tsx','utf8');
const ast = ts.createSourceFile('client.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let spectatorExitEffect='';
function findSpectatorExit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useLayoutEffect'&&node.arguments[0]?.getText(ast).includes('isSpectator && matchDone && currentRoom'))spectatorExitEffect=node.arguments[0].getText(ast);ts.forEachChild(node,findSpectatorExit);}
findSpectatorExit(ast);assert.ok(spectatorExitEffect,'Actual spectator auto-exit hook exists');
for(const [spectator,finished,present,expected] of [[true,true,true,1],[true,false,true,0],[false,true,true,0],[true,true,false,0]]){let exits=0;require('node:vm').runInNewContext(`(${spectatorExitEffect})()`,{isSpectator:spectator,matchDone:finished,currentRoom:present?{code:'123456'}:null,leaveRoom:()=>{exits++;}});assert.equal(exits,expected,'Only spectators automatically leave completed games');}
const names = new Set(['CompactBattleBoard','BoardTriangle','BoardCardSlot','BoardPile','PhaseTrack','SpectatorDeckStrip','BattleRoomChatPanel','BattleRoomChatHud','laneForTurn','turnForLane','parseSkillTargetSelection','PlayerHand','HandCard','CardHoverPreview']);
const extracted = ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.has(n.name?.text)).map(n=>n.getText(ast)).join('\n');
let waitingOverlay='';
function findWaiting(node){if(ts.isJsxElement(node)&&node.openingElement.attributes.properties.some(attribute=>ts.isJsxAttribute(attribute)&&attribute.name.text==='className'&&attribute.initializer?.getText(ast).includes('triad-spectator-waiting-overlay')))waitingOverlay=node.getText(ast);else ts.forEachChild(node,findWaiting);}
findWaiting(ast);assert.ok(waitingOverlay,'Actual waiting overlay is tested');
const transpile = code=>ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const modules = {};
for (const [id,pkg,file] of [['react','react','react.production.js'],['react/jsx-runtime','react','react-jsx-runtime.production.js'],['react-dom','react-dom','react-dom.production.js'],['react-dom/client','react-dom','react-dom-client.production.js'],['scheduler','scheduler','scheduler.production.js']]) modules[id] = fs.readFileSync(path.join(path.dirname(require.resolve(pkg)),'cjs',file),'utf8');
modules['lucide-react'] = fs.readFileSync(require.resolve('lucide-react'),'utf8');
modules['@/components/BattleArenaChat']=transpile(fs.readFileSync('components/BattleArenaChat.tsx','utf8'));
modules['@/components/BattleArenaHud']=transpile(fs.readFileSync('components/BattleArenaHud.tsx','utf8'));
modules['@/components/BattleArenaControls']=transpile(fs.readFileSync('components/BattleArenaControls.tsx','utf8'));
modules['@/components/BattleCardInspector']=transpile(fs.readFileSync('components/BattleCardInspector.tsx','utf8'));
const roombar = source.slice(source.indexOf('<section className="triad-game-roombar'), source.indexOf('<section className="hidden relative overflow-hidden border-b',source.indexOf('<section className="triad-game-roombar')));
modules.test = transpile(`import {useState,useLayoutEffect,useEffect,useRef,Fragment} from 'react';import {createPortal} from 'react-dom';import {Sparkles,Swords,MessageCircle,SendHorizontal,Smile,Clock3} from 'lucide-react';
import BattleArenaChat from '@/components/BattleArenaChat';
import { BattleArenaScoreplate, BattleArenaPhaseTrack, BattleArenaProgress, BattleArenaCardFrame, BattleArenaSurface } from '@/components/BattleArenaHud';
import { BattleArenaHeader, BattleArenaFormation, BattleArenaHand, BattleArenaStatus } from '@/components/BattleArenaControls';
import BattleCardInspector from '@/components/BattleCardInspector';
const TRIAD_TITLE='Triad Dominion (อำนาจสามผนึก) ฐาน 3 ใบ';
const playCardDeployment=()=>()=>{},TRIAD_CARD_BACK_SRC='/cards/card-backs/card-backs.png';
const Image=({fill,priority,quality,sizes,...props})=><img {...props} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>;
const MiniProfileHover=()=>null,RevealSpotlight=()=>null,SkillTargetOverlay=()=>null,TimeoutWarningOverlay=()=>null,BattleCinematic=()=>null;
const elementLabel={wood:'ธาตุไม้'};
const profileForParticipant=()=>null,getPlayableSkillTargetIds=()=>[];
const deckTimerText='9:59';
const cards=Array.from({length:20},(_,i)=>({cardNo:String(i+1).padStart(3,'0'),name:'Card '+i,kind:i<10?'monster':'skill',element:'wood',attack:1000,support:2000,skillText:'คำอธิบายสกิลสำหรับตรวจการอ่านการ์ด',sourceImage:'/cards/'+String(i+1).padStart(3,'0')+'.jpg'}));
const triangle={top:'001',left:'002',right:'003'},bot={top:'004',left:'005',right:'006'};
const currentRoom={code:'123456',seats:{},spectators:[],game:{chat:[{id:'initial',senderId:'other',senderName:'The Hope',text:'พร้อมสู้แล้ว!',createdAt:Date.now()}]}},isFieldPlayer=false,matchDone=false,currentDeckModeTitle='โหมดรวม',SPECTATOR_LIMIT=10,rankProfiles=[],participant={id:'viewer'};
const surrenderBattle=()=>{},leaveRoom=()=>{},sendRoomChat=async text=>{currentRoom.game.chat.push({id:String(Date.now()),senderId:'viewer',senderName:'ผู้ชม',text,createdAt:Date.now()});window.sentText=text;window.mount(false);return true;};
window.floodChat=()=>{currentRoom.game.chat=Array.from({length:45},(_,i)=>({id:'long-'+i,senderId:'other',senderName:'ผู้ชมทดสอบ',text:'ข้อความยาวสำหรับทดสอบพื้นที่แชตโดยไม่บังการ์ดหรือส่วนควบคุมสนาม '.repeat(3),createdAt:Date.now()}));window.mount(false);};
const SpectatorAvatarRail=()=> <div className="triad-spectator-avatar-rail">ผู้ชม</div>;
${extracted}
export default function Test({waiting=false}){if(window.testHand)return <BattleArenaSurface image={require('arena').triadArenas[0].image} className="triad-dominion-game"><PlayerHand cards={cards} usedSet={new Set()} player={{}} placementLane="top" activeLane="top" locked={false} onSelectLane={()=>{}} onPlayCard={no=>window.picked=no} onDropToLane={()=>{}} /></BattleArenaSurface>;return <BattleArenaSurface image={require('arena').triadArenas[0].image} className={'triad-dominion-game triad-spectator-mode '+(waiting?'triad-spectator-deck-waiting':'')}>
<BattleRoomChatHud room={currentRoom} currentUserId={participant.id} rankProfiles={rankProfiles} onSend={sendRoomChat} cinematicActive={Boolean(window.cinematicChat)}/>
{window.cinematicChat&&createPortal(<div data-test-cinematic style={{position:'fixed',inset:0,zIndex:2147483050,background:'#123'}}/>,document.body)}
<BattleArenaHeader title={TRIAD_TITLE} code="123456" time="1:30" onExit={leaveRoom}/>
<section className="triad-game-layout"><section className="triad-game-playarea"><div className="triad-spectator-live-stack">
{!waiting&&<SpectatorDeckStrip title="ฝั่งบน · The Hope" cards={cards} tone="top" onPreview={()=>window.previews=(window.previews||0)+1}/>}
<div className="triad-spectator-board-shell relative min-h-0"><CompactBattleBoard arena={require('arena').triadArenas[0]} battleSessionKey="test" cardsByNo={new Map(cards.map(c=>[c.cardNo,c]))} lockedFight={{player:triangle,bot,turns:[]}} player={triangle} revealed={{1:{player:true,bot:true,scored:false},2:{player:true,bot:true,scored:false},3:{player:true,bot:true,scored:false}}} activeTurn={1} matchScore={{player:0,bot:0}} fightNo={1} fightScore={{player:0,bot:0}} playerDeckLeft={20} botDeckLeft={20} playerGraveCards={[]} botGraveCards={[]} playerName="ผู้เล่นทดสอบ" botName="The Hope" playerImage="" botImage="" placementLane="top" timeLeft={90} battleActive={!waiting} turnLocked revealAllCards pendingSkillChoice={null} onSelectSkillTarget={()=>{}} onConfirmSkillTarget={()=>{}} onDrawRandomCard={()=>{}} onSelectLane={()=>{}} onPlaceCard={()=>{}}/>{waiting&&${waitingOverlay}}</div>
{!waiting&&<SpectatorDeckStrip title="ฝั่งล่าง · ผู้เล่นทดสอบ" cards={cards} tone="bottom"/>}</div></section><aside/></section></BattleArenaSurface>}
`);
modules.arena = transpile(fs.readFileSync('lib/triad-arena.ts','utf8'));
const bundle = Object.entries(modules).map(([id,code])=>`${JSON.stringify(id)}:function(require,module,exports){${code}\n}`).join(',');
const css = fs.readdirSync('.next/static/chunks').filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync('.next/static/chunks/'+f,'utf8')).join('\n')+'\n'+fs.readFileSync('app/globals.css','utf8')+'\n'+fs.readFileSync('components/BattleHud.css','utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}body{margin:0;background:#080b0e}#root{position:relative!important;inset:auto!important;width:100%!important;height:100dvh!important;max-height:none!important;max-width:none!important;margin:0!important;padding:0!important;box-sizing:border-box}@media(max-width:900px) and (orientation:portrait){#root{width:100dvh!important;height:100dvw!important;min-height:0!important}}</style></head><body><div id="root" class="nexora-battle-shell"></div><script>const modules={${bundle}},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](require,m,m.exports);return m.exports;}const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root'));window.mount=waiting=>root.render(React.createElement(require('test').default,{waiting}));mount(false);</script></body></html>`;
(async()=>{
 fs.mkdirSync('artifacts/triad-spectator',{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
 try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://spectator.test/**',route=>{const url=new URL(route.request().url());if(url.pathname==='/')return route.fulfill({body:html,contentType:'text/html'});const asset=path.resolve('public','.'+url.pathname);if(!asset.startsWith(path.resolve('public')+path.sep))return route.abort();return route.fulfill({body:fs.readFileSync(asset),contentType:asset.endsWith('.webp')?'image/webp':'image/jpeg'});});
 for(const [width,height] of [[3840,2160],[1920,1080],[1440,900],[1280,720],[1024,768],[844,390],[667,375],[390,844]]){
  await page.setViewportSize({width,height});await page.goto('https://spectator.test/');await page.waitForSelector('[data-board-card]');await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
  const rotated=width<height&&width<=900;
  const measure=await page.evaluate(()=>{const arena=document.querySelector('.triad-spectator-board'),main=document.querySelector('main');return {arena:arena.clientHeight,main:main.clientHeight,overflow:main.scrollHeight>main.clientHeight+1}});
  assert.ok(measure.arena/measure.main>.60,`Battlefield dominates ${width}x${height}: ${JSON.stringify(measure)}`);assert.equal(measure.overflow,false,'No page-height blank overflow');
  const rects=await page.locator('[data-board-card]').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}));assert.equal(rects.length,6);
  const hud=await page.locator('.triad-board-phase-hud').boundingBox();
  assert.equal(await page.locator('.triad-arena-background').count(),0,'The arena image is rendered only by the shared outer surface');
  assert.equal(await page.locator('.triad-arena-board').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','Inner board never paints a second arena');
  assert.ok((await page.locator('.nexora-arena-progress').innerText()).includes('แต้มไฟต์นี้'),'Turn points and fight wins have explicit labels');
  await page.screenshot({path:`artifacts/triad-spectator/screen-${width}-${height}.png`});
  for(let i=0;i<rects.length;i++){
   const r=rects[i];
   assert.ok(r.x>=-1&&r.y>=-1&&r.x+r.w<=width+1&&r.y+r.h<=height+1,`Card fits ${width}: ${JSON.stringify(r)}`);
   assert.ok((rotated?r.h:r.w)>=(Math.min(width,height)<500?30:width===1024?60:75),`Card readable ${width}: ${r.w}`);
   for(let j=0;j<i;j++){const b=rects[j];assert.ok(r.x+r.w<=b.x+1||b.x+b.w<=r.x+1||r.y+r.h<=b.y+1||b.y+b.h<=r.y+1,'No card overlaps');}
   assert.ok(rotated?r.x>=hud.x+hud.width-1:r.y+r.h<=hud.y+1,'No HUD overlap');
  }
  assert.equal(await page.locator('.triad-spectator-deck-cards > button').count(),40);
  assert.ok(await page.locator('.triad-spectator-deck-cards > button').evaluateAll(els=>els.every(e=>Math.abs(e.clientWidth/e.clientHeight-815/1110)<.04)),'Native rail card ratio');
  const local=await page.locator('.triad-arena-triangle').evaluateAll(els=>els.map(e=>({main:e.querySelector('[data-triad-lane="top"]').offsetTop,left:e.querySelector('[data-triad-lane="left"]').offsetTop})));
  assert.ok(local[0].main>local[0].left&&local[1].main<local[1].left,'NEXORA pyramid intact '+JSON.stringify(local));
  await page.screenshot({path:`artifacts/triad-spectator/screen-${width}-${height}.png`});
  assert.equal(await page.locator('.triad-battle-chat-hud').count(),1,'One chat instance');
  const chat=await page.locator('.triad-battle-chat-hud').boundingBox();
  assert.ok(rects.every(r=>r.x+r.w<=chat.x||chat.x+chat.width<=r.x||r.y+r.h<=chat.y||chat.y+chat.height<=r.y),'Chat never covers cards '+JSON.stringify({width,height,chat,rects}));
  const input=page.getByRole('textbox',{name:'ข้อความแชตสนาม'});
  await input.fill('พิมพ์ต่อระหว่างต่อสู้');
  await input.evaluate(e=>window.chatInput=e);
  await page.evaluate(()=>{cinematicChat=true;mount(false)});
  await page.waitForSelector('[data-cinematic-chat="true"]');
  assert.ok(await input.evaluate(e=>e===window.chatInput&&e===document.activeElement),'Input and focus persist into cinematic');
  assert.equal(await input.inputValue(),'พิมพ์ต่อระหว่างต่อสู้');
  await input.fill('ส่งระหว่างอนิเมชั่น');await input.press('Enter');
  await page.waitForFunction(()=>window.sentText==='ส่งระหว่างอนิเมชั่น');
  await page.screenshot({path:`artifacts/triad-spectator/chat-cinematic-${width}-${height}.png`});
  await page.evaluate(()=>{cinematicChat=false;mount(false)});
  await page.waitForSelector('[data-cinematic-chat="false"]');
  assert.ok(await input.evaluate(e=>e===window.chatInput),'Same input after cinematic');
  assert.equal(await input.inputValue(),'');
  await page.evaluate(()=>floodChat());await page.waitForFunction(()=>document.querySelectorAll('.triad-chat-hud-line').length===40);
  const fullChat=await page.locator('.triad-battle-chat-hud').boundingBox(),phaseCard=await page.locator('.triad-board-phase-card').boundingBox();
  const disjoint=(a,b)=>a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y;
  assert.ok(disjoint(fullChat,phaseCard),'Long chat never covers phase controls');
  assert.ok(rects.every(r=>disjoint(fullChat,{...r,width:r.w,height:r.h})),'Long chat never covers cards '+JSON.stringify({width,height,fullChat,rects}));
  assert.ok(await page.locator('.triad-chat-hud-messages').evaluate(e=>e.scrollHeight>e.clientHeight&&Math.abs(e.scrollTop+e.clientHeight-e.scrollHeight)<2),'History is scrollable and follows latest message');
  await page.evaluate(()=>mount(true));await page.waitForFunction(()=>document.querySelectorAll('.triad-spectator-deck-strip').length===0);const waiting=await page.locator('.triad-spectator-board').evaluate(e=>e.clientHeight);assert.ok(waiting>measure.arena,'Waiting scene expands into freed rail space');
  const overlay=await page.locator('.triad-spectator-waiting-overlay').boundingBox();for(const plate of await page.locator('.triad-opponent-scoreplate,.triad-player-scoreplate').all()){const score=await plate.boundingBox();assert.ok(disjoint(overlay,score),'Deck selection timer never covers scores '+JSON.stringify({width,height,overlay,score}));}
  assert.deepEqual(errors,[]);console.log(`Spectator ${width}x${height}: dominant arena, six readable cards, native ratios, pyramid, no overlaps, chat and waiting passed`);
 }
 await page.setViewportSize({width:1920,height:1080});await page.evaluate(()=>{window.testHand=true;mount(false);});await page.locator('.nexora-arena-hand').waitFor();
 for(const [label,count] of [['มอนสเตอร์',10],['สกิล',10],['ทั้งหมด',20]]){await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.locator('.nexora-arena-hand-cards > button').count(),count,'Triad hand filter '+label);}
 const filterSizes=await page.locator('.nexora-arena-hand-filters button').evaluateAll(els=>els.map(el=>({width:el.offsetWidth,height:el.offsetHeight,font:getComputedStyle(el).fontSize})));assert.ok(filterSizes.every(size=>size.width===112&&size.height===40&&size.font==='14px'),'Triad fixed filter dimensions');
 await page.locator('.nexora-arena-hand-cards > button').first().hover();await page.locator('.nexora-card-inspector-panel').waitFor();await page.locator('.nexora-card-inspector-panel').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})));});const inspector=await page.locator('.nexora-card-inspector-panel').boundingBox();assert.ok(inspector.x>1400,'Triad inspector is a right-side drawer');for(const button of await page.locator('.nexora-arena-hand-filters button').all()){const box=await button.boundingBox();assert.ok(box.y>=inspector.y+inspector.height||box.y+box.height<=inspector.y||box.x+box.width<=inspector.x||box.x>=inspector.x+inspector.width,'Inspector never covers filter buttons');}await page.screenshot({path:'artifacts/triad-spectator/shared-inspector.png'});await page.mouse.move(1,1);
 await page.getByRole('button',{name:'มอนสเตอร์',exact:true}).click();await page.locator('.nexora-arena-hand-cards > button').first().click();assert.equal(await page.evaluate(()=>window.picked),'001','Filtering never changes card identity');assert.deepEqual(errors,[]);console.log('Triad actual hand: all/monster/skill filters and selection passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
