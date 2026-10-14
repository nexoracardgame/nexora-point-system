const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const compile = code => ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const parse = file => {const source=fs.readFileSync(file,'utf8');return ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)};
const functions = (ast,names) => ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text)).map(n=>n.getText(ast)).join('\n');
const deferred = () => {let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
const response = payload => ({ok:true,status:200,json:async()=>payload});
const client=parse(process.env.TRIAD_CLIENT_SOURCE || 'app/(main)/battle/triad-dominion/TriadDominionClient.tsx');
const selected=new Map();let phaseEffect;
function visit(n){
 if(ts.isVariableDeclaration(n)&&['createRoom','startRoomGame','syncRooms','postRoomAction','enterBattle','toggleDeckCard'].includes(n.name.getText(client)))selected.set(n.name.getText(client),n.initializer.getText(client));
 if(ts.isCallExpression(n)&&n.expression.getText(client)==='useEffect'&&n.arguments[0]?.getText(client).includes('startRoomLockRef.current.code === currentRoom.code'))phaseEffect=n.arguments[0].getText(client);
 ts.forEachChild(n,visit);
}
visit(client);assert.equal(selected.size,6);assert.ok(phaseEffect);
function makeClient(){
 let roomList=[],phases=[],messages=[],resetCount=0;
 const c=vm.createContext({exports:{},Date,Number,URLSearchParams,AbortSignal,ROOM_API_PATH:'/api/triad-rooms',MIN_SYNC_GAP_MS:0,participant:{id:'host'},roomAccess:'public',roomPassword:'',createRoomWithBot:false,currentRoom:null,rooms:[],phase:'lobby',isRoomController:true,
  creatingRoomRef:{current:false},joiningRoomCodeRef:{current:''},startingRoomCodeRef:{current:''},roomResponseRevisionRef:{current:0},activeRoomCodeRef:{current:''},activeRoomSnapshotRef:{current:null},optimisticRoomLockUntilRef:{current:0},startRoomLockRef:{current:{code:'',until:0}},syncInFlightRef:{current:false},syncQueuedRef:{current:false},lastSyncAtRef:{current:0},lastRankSyncAtRef:{current:0},
  normalizeApiRooms:x=>x,normalizeRankProfile:x=>x,participantInRoom:(r,id)=>r.seats?.host?.id===id||r.seats?.challenger?.id===id,roomDecksReadyForBattle:()=>false,phaseForRoomWithBattleLock:()=> 'deck',markBattleStartedForRoom:()=>{},hasBattleStartedForRoom:()=>false,rememberDeckBattleStart:()=>{},writeCachedTriadRoom:()=>{},keepPendingOpeningTieBreakChoice:r=>r,mergeRoomWithStableChat:(_,r)=>r,forceApplyServerRoom:r=>r,
  mergeIncomingRooms:(_,next)=>next,mergeIncomingRoom:(list,r)=>[...list.filter(x=>x.code!==r.code),r],forceReplaceRoomByCode:(list,r)=>[...list.filter(x=>x.code!==r.code),r],
  setRooms:fn=>{roomList=fn(roomList)},setPhase:p=>{if(typeof p==='function')p=p(c.phase);c.phase=p;phases.push(p)},setLobbyMessage:m=>messages.push(m),setCreatingRoom:v=>{c.creatingRoom=v},setCreateModeDialogOpen:v=>{c.dialogOpen=v},setActiveRoomCode:()=>{},setActiveRoomSnapshot:r=>{c.currentRoom=r},setStableActiveRoomSnapshot:r=>{c.activeRoomSnapshotRef.current=r;c.currentRoom=r;return r},resetBattle:()=>{resetCount++;c.phase='deck'},setResumeChecking:()=>{},setRankProfiles:()=>{},setLeaderboard:()=>{},
  window:{setTimeout:()=>1,clearTimeout:()=>{}},globalThis:undefined,
 });
 c.globalThis=c;
 vm.runInContext(compile([...selected].map(([name,code])=>`const ${name}=${code};`).join('\n')+`\nconst phaseEffect=${phaseEffect};globalThis.handlers={createRoom,startRoomGame,syncRooms,postRoomAction,enterBattle,toggleDeckCard,phaseEffect};`),c);
 return {c,phases,messages,getRooms:()=>roomList,resets:()=>resetCount};
}
const room=(status='waiting',epoch=100)=>({code:'123456',status,hostId:'host',seats:{host:{id:'host'},challenger:{id:'challenger'}},spectators:[],game:{deckStartedAt:epoch,activeTurn:1,fightNo:1,turns:[],deckReady:{host:false,challenger:false},decks:{host:[],challenger:[]}}});
(async()=>{
 const api=parse('app/api/triad-rooms/route.ts');let jobs=[],publishCalls=0;
 const a=vm.createContext({exports:{},URL,structuredClone,after:fn=>jobs.push(fn),publishTriadRoomRealtime:async()=>{publishCalls++},noStoreJson:(body,init)=>({body,init}),cleanText:x=>String(x||'').trim(),getApiActor:async()=>({id:'host'}),listTriadRooms:async()=>{a.lists++;return [room()]},getTriadRoomForParticipant:async(code,id)=>{a.singles++;assert.equal(id,'host');return room()},listTriadRankProfiles:async()=>{a.ranks++;return []},lists:0,singles:0,ranks:0});
 vm.runInContext(compile(functions(api,['roomActionJson','GET'])),a);
 await a.roomActionJson({ok:true},undefined,{action:'start'});assert.equal(publishCalls,0,'HTTP response never waits for realtime');assert.equal(jobs.length,1);await jobs[0]();assert.equal(publishCalls,1);
 const scoped=await a.GET({url:'https://test/api/triad-rooms?room=123456&ranks=0'});assert.equal(scoped.body.scope,'room');assert.equal(a.singles,1);assert.equal(a.lists,0);assert.equal(a.ranks,0);
 await a.GET({url:'https://test/api/triad-rooms?ranks=0'});assert.equal(a.lists,1);assert.equal(a.ranks,0);
 await a.GET({url:'https://test/api/triad-rooms'});assert.equal(a.ranks,1,'Legacy GET keeps rank response');
 assert.equal((await a.GET({url:'https://test/api/triad-rooms?room=bad'})).init.status,400);
 const state=makeClient(),c=state.c;const create=deferred();let posts=0;c.fetch=async()=>{posts++;return create.promise};
 c.dialogOpen=true;const creating=c.handlers.createRoom('all');assert.equal(c.creatingRoom,true,'Create responds before network');assert.equal(c.dialogOpen,true,'Dialog does not blink back to lobby');
 await c.handlers.createRoom('all');assert.equal(posts,1,'Duplicate create is blocked');
 create.resolve(response({room:room()}));await creating;assert.equal(c.dialogOpen,false);assert.equal(c.phase,'room');assert.equal(c.creatingRoom,false);assert.equal(c.activeRoomCodeRef.current,'123456');
 c.handlers.toggleDeckCard('007');await c.handlers.enterBattle();assert.equal(posts,1,'Opening preview cannot select or submit cards from an old deck epoch');
 const start=deferred();c.fetch=async()=>{posts++;return start.promise};const starting=c.handlers.startRoomGame();assert.equal(c.phase,'deck','Start transitions before network');
 assert.equal(c.startRoomLockRef.current.until,Infinity);await c.handlers.startRoomGame();assert.equal(posts,2,'Duplicate start is blocked');c.handlers.phaseEffect();assert.equal(c.phase,'deck','Waiting snapshot cannot reverse pending start');
 start.resolve(response({room:room('playing',200)}));await starting;assert.equal(c.startingRoomCodeRef.current,'');assert.equal(c.phase,'deck');assert.equal(state.resets(),1);
 const stale=deferred();c.lastRankSyncAtRef.current=Date.now();let url='';c.fetch=async u=>{url=u;return stale.promise};const syncing=c.handlers.syncRooms({force:true});assert.match(url,/room=123456/);assert.match(url,/ranks=0/);
 c.roomResponseRevisionRef.current++;stale.resolve(response({scope:'room',rooms:[]}));await syncing;assert.equal(c.phase,'deck','Old GET cannot close a newly changed room');
 c.fetch=async()=>response({scope:'room',rooms:[room('playing',200)]});await c.handlers.syncRooms({force:true});assert.equal(state.getRooms().length,1);
 c.phase='room';c.joiningRoomCodeRef.current='123456';c.fetch=async()=>response({scope:'room',rooms:[]});await c.handlers.syncRooms({force:true});assert.equal(c.phase,'room','Unconfirmed join cannot flash back to lobby');c.joiningRoomCodeRef.current='';
 c.phase='deck';c.startingRoomCodeRef.current='123456';c.fetch=async()=>response({scope:'room',rooms:[room()]});await c.handlers.syncRooms({force:true});assert.equal(c.phase,'deck','Slow waiting read cannot flash room UI');c.startingRoomCodeRef.current='';
 c.fetch=async()=>{throw new Error('offline')};assert.equal((await c.handlers.postRoomAction({action:'start',code:'123456'})).ok,false,'Network failure is handled, not an unhandled rejection');
 const ready=makeClient();Object.assign(ready.c,{currentRoom:room('playing'),roomPlayerSide:'host',opponentSide:'challenger',ownDeckReady:false,deckReadySubmitting:false,playerDeckCards:[],playerDeck:[],deckValidation:{valid:true},deckSyncTimerRef:{current:null},deckSyncQueueRef:{current:new Promise(()=>{})},setDeckReadySubmitting:()=>{},setBattleLog:()=>{},setBotDeck:()=>{},setPlayerDeck:()=>{}});ready.c.activeRoomSnapshotRef.current=ready.c.currentRoom;ready.c.activeRoomCodeRef.current='123456';let readyCalled=false;ready.c.fetch=async()=>{readyCalled=true;return {ok:false,status:409,json:async()=>({})}};await ready.c.handlers.enterBattle();assert.equal(readyCalled,true,'Ready POST does not wait behind draft sync queue');
 const sharing=vm.createContext({roomDecksReadyForBattle:()=>false,mergeRoomWithStableChat:(_,r)=>r});vm.runInContext(compile(functions(client,['mergeRoomByCode','shouldKeepCurrentRoomSnapshot','roomProgressValue'])),sharing);
 const list=[room('playing')];assert.equal(sharing.mergeRoomByCode(list,structuredClone(list[0])),list,'Unchanged polling retains references and does not rerender cards');
 const store=parse('lib/triad-room-store.ts');let stored=room(),reads=[],writes=0,starts=0,warmCalls=0;
 const s=vm.createContext({exports:{},Date,Promise,structuredClone,console,globalForTriadRooms:{},cleanText:x=>x,publicRoom:r=>structuredClone(r),getStoredRoom:async code=>{reads.push(code);await new Promise(r=>setTimeout(r,2));return structuredClone(stored)},upsertStoredRoom:async r=>{writes++;stored=structuredClone(r)},participantInStoredRoom:(r,id)=>r.seats.host?.id===id,roomExpired:()=>false,deleteStoredRoom:async()=>{},repairSelectionPools:()=>false,enforceDeckGate:()=>false,markExpiredSkillChoices:()=>false,resolveIfBothLocked:()=>{},runBotBrain:()=>false,healTriadRoomState:()=>false,isTriadBotParticipant:p=>p?.id==='bot',canControlStoredRoom:(_,id)=>id==='host',freshGameForRoom:r=>{starts++;return {...r.game,deckStartedAt:200}},ensureBotDeckReady:()=>{}});
 vm.runInContext(compile(functions(store,['withRoomMutationLock','refreshTriadRoom','getTriadRoomForParticipant','startTriadRoom','warmBotMemory'])),s);
 const hydration=deferred();s.hydrateBotMemoryFromDb=async()=>{warmCalls++;await hydration.promise;s.globalForTriadRooms.nexoraTriadBotMemoryHydrated=true};
 const warmed=[s.warmBotMemory(),s.warmBotMemory(),s.warmBotMemory()];assert.equal(warmCalls,1,'Bot cold-start hydration is shared');hydration.resolve();await Promise.all(warmed);
 await s.getTriadRoomForParticipant('123456','host');assert.deepEqual(reads,['123456'],'Active polling reads one room');assert.equal(await s.getTriadRoomForParticipant('123456','outsider'),null);
 await Promise.all([s.startTriadRoom('123456','host'),s.startTriadRoom('123456','host')]);assert.equal(starts,1,'Concurrent start cannot reset selection twice');assert.equal(writes,1);
 let createButton,startButton;
 function findButton(n){if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(client)==='button'){const code=n.getText(client);if(code.includes('void createRoom(createRoomMode)'))createButton=code;if(code.includes('onClick={startRoomGame}'))startButton=code}ts.forEachChild(n,findButton)}
 findButton(client);assert.ok(createButton&&startButton);
 const modules={};
 for(const [id,pkg,file] of [['react','react','react.production.js'],['react/jsx-runtime','react','react-jsx-runtime.production.js'],['react-dom','react-dom','react-dom.production.js'],['react-dom/client','react-dom','react-dom-client.production.js'],['scheduler','scheduler','scheduler.production.js']])modules[id]=fs.readFileSync(path.join(path.dirname(require.resolve(pkg)),'cjs',file),'utf8');
 modules['lucide-react']=fs.readFileSync(require.resolve('lucide-react'),'utf8');
 modules.controls=ts.transpileModule(`import {useState,useRef,useEffect} from 'react';import {Loader2,Swords} from 'lucide-react';
 export default function Controls(){
 const [phase,setPhase]=useState('lobby'),[currentRoom,setRoom]=useState(null),[creatingRoom,setCreatingRoom]=useState(false),[message,setLobbyMessage]=useState('');
 const creatingRoomRef=useRef(false),startingRoomCodeRef=useRef(''),activeRoomCodeRef=useRef(''),activeRoomSnapshotRef=useRef(null),startRoomLockRef=useRef({code:'',until:0});
 const participant={id:'host'},roomAccess='public',roomPassword='',createRoomMode='all',createRoomWithBot=false,isRoomController=true,canStart=true;
 const normalizeApiRooms=x=>x,setActiveRoomSnapshot=setRoom,setActiveRoomCode=()=>{},setCreateModeDialogOpen=()=>{},participantInRoom=()=>true,roomDecksReadyForBattle=()=>false,markBattleStartedForRoom=()=>{},hasBattleStartedForRoom=()=>false,phaseForRoomWithBattleLock=()=> 'deck',resetBattle=()=>setPhase('deck'),syncRooms=async()=>[];
 const postRoomAction=async body=>{window.actions.push(body.action);return new Promise(resolve=>window.resolveResponse=()=>{const room={code:'123456',status:body.action==='start'?'playing':'waiting',seats:{host:{id:'host'},challenger:{id:'challenger'}},game:{deckStartedAt:100,deckReady:{host:false,challenger:false},decks:{host:[],challenger:[]}}};if(body.action==='start')setRoom(room);resolve({ok:true,status:200,payload:{room}})})};
 const createRoom=${selected.get('createRoom')};const startRoomGame=${selected.get('startRoomGame')};
 useEffect(${phaseEffect},[phase,currentRoom]);
 return <main data-phase={phase}><h1>{phase==='lobby'?'NEXORA':phase==='room'?'ห้อง 123456':'เลือกเด็ค'}</h1>{phase==='lobby'?${createButton}:phase==='room'?${startButton}:<div>20</div>}<span>{message}</span></main>;
 }`,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const bundle=Object.entries(modules).map(([id,code])=>`${JSON.stringify(id)}:function(require,module,exports){${code}\n}`).join(',');
 const html=`<html><head><meta charset="utf-8"><style>body{margin:0;background:#10181b;color:white;font-family:Arial}main{padding:24px}button{height:44px;min-width:180px;background:#ffd65a;border:0;border-radius:6px;cursor:pointer}button:disabled{opacity:.7}svg{width:16px;height:16px}span{display:inline-flex;gap:8px;align-items:center}h1{font-size:24px}</style></head><body><div id="root"></div><script>window.actions=[];const modules={${bundle}},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](require,m,m.exports);return m.exports;}const React=require('react');require('react-dom/client').createRoot(document.getElementById('root')).render(React.createElement(require('controls').default));</script></body></html>`;
 const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://responsiveness.test/**',route=>route.fulfill({body:html,contentType:'text/html'}));
 for(const [width,height] of [[1440,900],[844,390]]){
  await page.setViewportSize({width,height});await page.goto('https://responsiveness.test/');await page.getByRole('button',{name:'ยืนยันสร้างห้อง'}).waitFor();
  await page.evaluate(()=>{const at=performance.now();document.querySelector('button').click();requestAnimationFrame(()=>{window.feedback={elapsed:performance.now()-at,busy:document.querySelector('button').getAttribute('aria-busy')}})});
  await page.waitForFunction(()=>window.feedback?.busy==='true');assert.ok(await page.evaluate(()=>feedback.elapsed<150),'Create feedback arrives within one or two frames');
  assert.equal(await page.locator('main').getAttribute('data-phase'),'lobby');assert.equal(await page.getByRole('button',{name:'กำลังสร้างห้อง'}).isDisabled(),true);
  await page.evaluate(()=>resolveResponse());await page.getByRole('button',{name:'เริ่มเกม'}).waitFor();await page.getByRole('button',{name:'เริ่มเกม'}).click();
  await page.waitForFunction(()=>document.querySelector('main').dataset.phase==='deck');
  await page.waitForTimeout(width===1440?5300:150);assert.equal(await page.locator('main').getAttribute('data-phase'),'deck','No room flash even beyond the old five-second lock');
  await page.evaluate(()=>resolveResponse());await page.waitForTimeout(50);assert.equal(await page.locator('main').getAttribute('data-phase'),'deck');
 }
 assert.deepEqual(errors,[]);
 }finally{await browser.close()}
 console.log('Responsiveness: immediate create/start feedback, duplicate guards, no stale-page flash, draft queue bypass, one-room polling, optional ranks, post-response realtime, shared bot hydration, authorized reads and idempotent starts passed');
})().catch(error=>{console.error(error);process.exitCode=1});
