const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const transpile = code => ts.transpileModule(code, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const source = fs.readFileSync('app/(main)/battle/triad-dominion/TriadDominionClient.tsx','utf8');
const ast = ts.createSourceFile('client.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let effect;
function visit(n) {
  if(ts.isCallExpression(n) && n.expression.getText(ast)==='useEffect' && n.arguments[0]?.getText(ast).includes('completedCinematicTurn !== autoCinematicTurnKey')) effect=n.arguments[0].getText(ast);
  ts.forEachChild(n,visit);
}
visit(ast);assert.ok(effect);
let advances=0,turns=0,fights=0;
const c=vm.createContext({phase:'battle',matchDone:false,isSpectator:false,activeTurnScored:true,completedCinematicTurn:'',autoCinematicTurnKey:'room:100:1:1',currentRoom:{game:{activeTurn:1,turns:[{turn:1,winner:'host'}]}},roomPlayerSide:'host',autoAdvanceAttemptRef:{current:''},activeTurn:1,markRoomTurnReady:()=>advances++,nextTurn:()=>turns++,nextFight:()=>fights++});
vm.runInContext(transpile(`const effect=${effect};`),c);
const run=()=>vm.runInContext('effect()',c);
run();assert.equal(advances,0,'Never advance before animation finishes');
c.completedCinematicTurn=c.autoCinematicTurnKey;c.isSpectator=true;run();assert.equal(advances,0);
c.isSpectator=false;c.currentRoom.game.turns[0].winner='draw';run();assert.equal(advances,0,'Opening draw waits for RPS');
c.currentRoom.game.turns[0].winner='host';run();run();assert.equal(advances,1,'Completion sends once');
c.autoCinematicTurnKey='room:200:1:1';run();assert.equal(advances,1,'Old match completion cannot advance rematch');
c.completedCinematicTurn=c.autoCinematicTurnKey;c.currentRoom=null;run();assert.equal(turns,1);
c.autoCinematicTurnKey='solo:1:1:3';c.completedCinematicTurn=c.autoCinematicTurnKey;c.activeTurn=3;run();assert.equal(fights,1);
const store=fs.readFileSync('lib/triad-room-store.ts','utf8');
const storeAst=ts.createSourceFile('store.ts',store,ts.ScriptTarget.Latest,true);
const names=new Set(['withRoomMutationLock','advanceTriadRoomTurn','readyBotForAdvance','emptyTriangle','emptyOpeningTieBreak']);
const code=storeAst.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.has(n.name?.text)).map(n=>n.getText(storeAst)).join('\n');
let stored;
const s=vm.createContext({exports:{},Date,globalForTriadRooms:{},cleanText:x=>x,sideForParticipant:(_,id)=>['host','challenger'].includes(id)?id:null,participantInStoredRoom:()=>false,publicRoom:r=>structuredClone(r),getStoredRoom:async()=>{await new Promise(r=>setTimeout(r,2));return structuredClone(stored)},upsertStoredRoom:async r=>{stored=structuredClone(r)},isTriadBotParticipant:p=>p?.id==='bot',finalizeNineTurnMatchIfNeeded:r=>{if(r.game.fightNo<3)return false;r.game.matchEndedAt=Date.now();return true},runBotBrain:r=>s.readyBotForAdvance(r)});
vm.runInContext(transpile(code),s);
function reset(turn=1,fight=1,bot=false){stored={code:'test',seats:{challenger:{id:bot?'bot':'challenger'}},game:{deckStartedAt:100,activeTurn:turn,fightNo:fight,turns:[{turn,winner:'host'}],turnReady:{host:false,challenger:false},openerTieBreak:{status:'waiting',winner:''}}};}
const advance=(side,epoch=100,turn=1,fight=1)=>s.advanceTriadRoomTurn('test',side,{deckStartedAt:epoch,turn,fightNo:fight});
(async()=>{
  reset();await advance('host');assert.equal(stored.game.activeTurn,1,'Wait for other viewer');
  await advance('challenger');assert.equal(stored.game.activeTurn,2);
  await advance('host');assert.equal(stored.game.activeTurn,2,'Duplicate cannot skip a turn');
  reset();await Promise.all([advance('host'),advance('challenger'),advance('host')]);assert.equal(stored.game.activeTurn,2);
  reset();await advance('host',99);assert.equal(stored.game.turnReady.host,false,'Old epoch rejected');
  reset(1,1,true);await advance('host');assert.equal(stored.game.activeTurn,2,'Bot advances after human cinematic');
  reset(3);await Promise.all([advance('host',100,3),advance('challenger',100,3)]);assert.equal(stored.game.fightNo,2);assert.equal(stored.game.activeTurn,1);
  reset(3,3);await advance('host',100,3,3);await advance('challenger',100,3,3);assert.ok(stored.game.matchEndedAt);
  reset();stored.game.turns[0].winner='draw';assert.equal((await advance('host')).reason,'opener_tiebreak_waiting');
  const arena=vm.createContext({exports:{}});vm.runInContext(transpile(fs.readFileSync('lib/triad-arena.ts','utf8')),arena);
  assert.equal(arena.exports.battleArenaForSeed('room:100'),arena.exports.battleArenaForSeed('room:100'));
  assert.equal(new Set(Array.from({length:100},(_,i)=>arena.exports.battleArenaForSeed(`room:${i}`).id)).size,5);
  console.log('Auto advance: completion gate, RPS, spectators, retries, bot/PVP, duplicates, concurrency, rematch epochs, final match and shared five-arena seeds passed');
})().catch(e=>{console.error(e);process.exitCode=1});
