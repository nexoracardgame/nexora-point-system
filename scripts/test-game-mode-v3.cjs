const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const transpile=code=>ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const source=fs.readFileSync(process.env.TRIAD_CLIENT_SOURCE||'app/(main)/battle/triad-dominion/TriadDominionClient.tsx','utf8');
const ast=ts.createSourceFile('client.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let createHandler='';
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='createRoom'&&node.initializer?.getText(ast).includes('creatingRoomRef.current'))createHandler='const '+node.getText(ast)+';';ts.forEachChild(node,visit);}visit(ast);
assert.ok(createHandler,'Test the original createRoom handler, not a replacement');
const start=source.indexOf('{createModeDialogOpen ? ('),end=source.indexOf('<NexoraCommandLobby participant=',start);
const markup=source.slice(start,end).trim();
const modules={};
for(const [id,pkg,file] of [['react','react','react.production.js'],['react/jsx-runtime','react','react-jsx-runtime.production.js'],['react-dom','react-dom','react-dom.production.js'],['react-dom/client','react-dom','react-dom-client.production.js'],['scheduler','scheduler','scheduler.production.js']])modules[id]=fs.readFileSync(path.join(path.dirname(require.resolve(pkg)),'cjs',file),'utf8');
modules['lucide-react']=fs.readFileSync(require.resolve('lucide-react'),'utf8');
modules['./GameModeModal.css']='';
modules['@/components/GameModeModal']=transpile(fs.readFileSync('components/GameModeModal.tsx','utf8'));
modules.test=transpile(`import {useState,useRef} from 'react';import GameModeModal from '@/components/GameModeModal';
export default function Test(){
const createFormat=new URLSearchParams(location.search).get('format')||'triad',SKILL_MODE_MONSTER_LIMIT=10,SKILL_MODE_SKILL_LIMIT=10;
const [createModeDialogOpen,setCreateModeDialogOpen]=useState(false),[createRoomMode,setCreateRoomMode]=useState('all'),[createRoomWithBot,setCreateRoomWithBot]=useState(false),[creatingRoom,setCreatingRoom]=useState(false),[lobbyMessage,setLobbyMessage]=useState('');
const creatingRoomRef=useRef(false),activeRoomSnapshotRef=useRef(null),activeRoomCodeRef=useRef('');
const roomAccess=window.privateRoom?'private':'public',roomPassword=window.privateRoom?'secret123':'';
const router={push:url=>window.destination=url},setActiveRoomSnapshot=()=>{},setActiveRoomCode=()=>{},setPhase=value=>window.phase=value;
const normalizeApiRooms=rooms=>rooms,roomDecksReadyForBattle=()=>false,markBattleStartedForRoom=()=>{},phaseForRoomWithBattleLock=()=> 'deck';
const postRoomAction=async payload=>{const response=await fetch('/api/triad-rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});return {ok:response.ok,payload:await response.json()};};
${createHandler}
return <main><button id="open" onClick={()=>setCreateModeDialogOpen(true)}>เปิดเลือกโหมด</button><output>{lobbyMessage}</output>${markup}</main>;}
`);
const bundle=Object.entries(modules).map(([id,code])=>`${JSON.stringify(id)}:function(require,module,exports){${code}\n}`).join(',');
const html=`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#07090a url('/images/triad/nexora-command-original.webp') center/cover fixed;font-family:Arial,sans-serif}button{font:inherit} ${fs.readFileSync('components/GameModeModal.css','utf8')}</style></head><body><div id="root"></div><script>const modules={${bundle}},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](require,m,m.exports);return m.exports;}require('react-dom/client').createRoot(document.getElementById('root')).render(require('react').createElement(require('test').default));</script></body></html>`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('https://modes.test/**',async route=>{const url=new URL(route.request().url());if(url.pathname.startsWith('/api/')){requests.push({url:url.pathname,...route.request().postDataJSON()});await new Promise(resolve=>setTimeout(resolve,250));return route.fulfill({json:{room:{code:'123456',status:'waiting'}}});}if(url.pathname==='/')return route.fulfill({body:html,contentType:'text/html'});const file=path.resolve('public','.'+url.pathname);if(!file.startsWith(path.resolve('public')+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.png')?'image/png':'image/webp'});});
fs.mkdirSync('artifacts/mode-ui-v3/screenshots',{recursive:true});
for(const format of ['triad','pentad'])for(const [width,height] of [[1920,1080],[2560,1440],[3840,2160],[1024,768],[844,390],[390,844]]){
await page.setViewportSize({width,height});await page.goto('https://modes.test/?format='+format);await page.locator('#open').click();const dialog=page.getByRole('dialog');await dialog.waitFor();await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));await page.waitForTimeout(450);
const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,'Modal fits viewport');assert.ok(Math.abs(bounds.x+bounds.width/2-width/2)<2&&Math.abs(bounds.y+bounds.height/2-height/2)<2,'Modal is centered');
const cards=page.locator('.nexora-v3-mode');assert.equal(await cards.count(),format==='triad'?3:2);assert.equal(await page.locator('[aria-pressed="true"]').count(),1);
for(let i=0;i<await cards.count();i++){await cards.nth(i).click();assert.equal(await cards.nth(i).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[aria-pressed="true"]').count(),1);}
const toggle=page.getByRole('switch');await toggle.click();assert.equal(await toggle.getAttribute('aria-checked'),'true');await toggle.click();assert.equal(await toggle.getAttribute('aria-checked'),'false');
await cards.first().click();await dialog.evaluate(el=>el.scrollTop=0);await page.screenshot({path:'artifacts/mode-ui-v3/screenshots/'+format+'-'+width+'.png'});
const textRects=await page.locator('.nexora-v3-mode-info').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {width:r.width,scroll:el.scrollWidth,client:el.clientWidth};}));assert.ok(textRects.every(r=>r.scroll<=r.client+1),'Text fits every mode card');
assert.equal(await page.locator('.nexora-v3-fx').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
await page.getByRole('button',{name:'ยกเลิก',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>document.activeElement.id),'open');
await page.locator('#open').click();await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
console.log(format+' '+width+'x'+height+': selection, BOT, cancel/Escape, assets and bounds passed');
}
for(const format of ['triad','pentad'])for(const mode of format==='triad'?['all','monster','skill']:['all','monster'])for(const bot of [false,true]){
await page.setViewportSize({width:1920,height:1080});await page.goto('https://modes.test/?format='+format);await page.evaluate(()=>window.privateRoom=true);await page.locator('#open').click();await page.locator('.nexora-v3-mode[data-mode="'+mode+'"]').click();if(bot)await page.getByRole('switch').click();const before=requests.length;await page.getByRole('button',{name:'ยืนยันสร้างห้อง',exact:true}).click();assert.equal(await page.getByRole('button',{name:'กำลังสร้างห้อง'}).isDisabled(),true);await page.waitForFunction(()=>window.destination||window.phase);assert.equal(requests.length,before+1,'One room request per confirmation');const sent=requests.at(-1);assert.equal(sent.action,'create');assert.equal(sent.access,'private');assert.equal(sent.password,'secret123');assert.equal(sent.playWithBot,bot);if(format==='triad'){assert.equal(sent.deckMode,mode);assert.equal(sent.url,'/api/triad-rooms');}else{assert.equal(sent.deckSource,mode==='all'?'all':'random');assert.equal(sent.url,'/api/pentad-rooms');assert.equal(await page.evaluate(()=>window.destination),'/battle/pentad-dominion?room=123456');}
}
await page.goto('https://modes.test/?format=triad');await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#open').click();assert.equal(await page.locator('.nexora-v3-float').first().evaluate(el=>getComputedStyle(el).animationName),'none');await page.getByRole('button',{name:'ยกเลิก',exact:true}).focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'ปิดหน้าต่างเลือกโหมด');await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'ยกเลิก');await page.getByRole('button',{name:'ปิดหน้าต่างเลือกโหมด'}).click();await page.getByRole('dialog').waitFor({state:'detached'});assert.deepEqual(errors,[]);console.log('Original room handler: all 10 mode/BOT payloads unchanged, private password, pending lock, navigation, reduced motion and no console errors passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
