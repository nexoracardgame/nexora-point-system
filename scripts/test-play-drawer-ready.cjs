const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-settings-ui.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle='))+'return modules;')(require);
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const source=fs.readFileSync('app/(main)/battle/triad-dominion/TriadDominionClient.tsx','utf8'),ast=ts.createSourceFile('client.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const lobby=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='NexoraCommandLobby').getText(ast);
modules['@/lib/lobby-assets']=compile(fs.readFileSync('lib/lobby-assets.ts','utf8'));
modules.button=compile(fs.readFileSync('components/LobbyActionButton.tsx','utf8'));modules['./LobbyActionButton.css']='';modules['@/lib/game-ui-audio']='exports.playGameUiSound=()=>{};';
modules.app=compile(`import React,{useState,useEffect,useRef} from 'react';import {Users,Swords,X,Plus,KeyRound,Loader2,Lock} from 'lucide-react';import LobbyActionButton from 'button';import {loadLobbyAssets} from '@/lib/lobby-assets';
const profileForParticipant=()=>null,playGameUiSound=()=>{},playMenuCue=()=>{},playDrawerSound=()=>{};
const NexoraCommandScene=()=>null,GameLobbyProfile=()=>null,LobbyBanner=()=>null,DuelistLeaderboard=()=>null,RankLeaderboardPanel=()=>null;
const GameLobbyNavigation=({onJoin,onRank})=><nav className="nexora-command-nav"><button onClick={onJoin}>JOIN</button><button onClick={onRank}>RANK</button></nav>;
${lobby}
export default function App(){const [ready,setReady]=useState(false),[access,setAccess]=useState('public'),[password,setPassword]=useState(''),[code,setCode]=useState('');useEffect(()=>{window.assetPromise=loadLobbyAssets();window.assetPromise.then(()=>setReady(true))},[]);return ready?<NexoraCommandLobby participant={{id:'self',name:'Me'}} rankProfiles={{}} leaderboard={[]} rooms={[]} roomAccess={access} setRoomAccess={setAccess} roomPassword={password} setRoomPassword={setPassword} joinCode={code} setJoinCode={setCode} joiningRoomCode="" lobbyMessage="" onCreate={format=>window.createdFormat=format} onEnter={()=>{}} onNavigate={()=>{}}/>:<p role="status">Preparing</p>}`);
const css=['components/LobbyActionButton.css','app/(main)/battle/triad-dominion/NexoraCommand.css','app/(main)/battle/triad-dominion/NexoraLobbyDrawer.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n');
const script=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}require('react-dom/client').createRoot(document.getElementById('root')).render(require('react').createElement(require('app').default));`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});fs.mkdirSync('artifacts/play-drawer-ready',{recursive:true});try{for(const [width,height]of [[1920,1080],[1366,768],[844,390],[390,844]]){
 const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',error=>errors.push(error.message));let release,offline=false,lateRequests=[];
 await page.route('http://play.test/**',async route=>{const url=new URL(route.request().url());if(url.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><style>body{margin:0;background:#230c06}#root{height:100dvh}${css}.nexora-command-lobby{--lobby-drawer-scale:${Math.min(width/(width<1100||height<650?1400:1920),height/(width<1100||height<650?820:1080))}}</style><div id="root"></div><script>${script}</script>`});
  if(offline){lateRequests.push(url.pathname);return route.abort()}
  if(url.pathname.endsWith('/drawer.webp'))await new Promise(resolve=>{release=resolve});
  const file=path.join('public',url.pathname);return fs.existsSync(file)?route.fulfill({body:fs.readFileSync(file),contentType:'image/webp'}):route.abort();
 });
 await page.goto('http://play.test/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(window.assetPromise));await page.waitForTimeout(150);assert.equal(await page.locator('.nexora-create-drawer').count(),0,'Cold entry waits for drawer artwork');release();
 await page.locator('.nexora-create-drawer').waitFor({state:'attached'});await page.waitForTimeout(100);
 assert.equal(await page.getByRole('dialog').count(),0,'Resident closed drawer is not accessible');assert.equal(await page.locator('.nexora-command-nav').isVisible(),true);
 await page.evaluate(()=>window.originalDrawer=document.querySelector('.nexora-create-drawer'));
 offline=true;await page.context().setOffline(true);
 for(let repeat=0;repeat<3;repeat++){
  await page.getByRole('button',{name:'PLAY สร้างสนามประลอง'}).click();await page.waitForTimeout(300);const drawer=page.getByRole('dialog',{name:'สร้างห้อง'});await drawer.waitFor();
  assert.equal(await page.evaluate(()=>window.originalDrawer===document.querySelector('.nexora-create-drawer')),true,'Opening keeps the prepared DOM');
  assert.ok((await drawer.evaluate(el=>getComputedStyle(el).backgroundImage)).includes('/drawer.webp'));assert.equal(await drawer.getAttribute('inert'),null);
  if(repeat===0){await page.screenshot({path:`artifacts/play-drawer-ready/${width}.png`});await drawer.getByRole('button',{name:'PENTAD 5 ใบ',exact:true}).click();await drawer.getByRole('button',{name:'ส่วนตัว',exact:true}).click();await drawer.locator('input').fill('abcd');}
  else{assert.equal(await drawer.getByRole('button',{name:'PENTAD 5 ใบ',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await drawer.locator('input').inputValue(),'abcd');}
  await page.keyboard.press('Escape');await drawer.waitFor({state:'hidden'});assert.equal(await page.locator('.nexora-command-nav').isVisible(),true);
 }
 assert.deepEqual(lateRequests,[],'Opening and reopening must not fetch artwork');assert.deepEqual(errors,[]);console.log(`PLAY ${width}x${height}: slow cold preload, decoded artwork, three offline opens, persistent DOM and close passed`);await page.close();
}}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
