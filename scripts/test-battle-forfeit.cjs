const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const transpile=code=>ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const cache={};function load(file){if(cache[file])return cache[file].exports;const module=cache[file]={exports:{}};vm.runInThisContext('(function(require,module,exports){'+transpile(fs.readFileSync(file,'utf8'))+'\n})')((id)=>id==='./prisma'?{prisma:{}}:id.startsWith('./')?load('lib/'+id.slice(2)+'.ts'):id==='@/public/cards/card-skill-db.json'?require('../public/cards/card-skill-db.json'):require(id),module,module.exports);return module.exports;}
const pentad=load('lib/pentad-room-store.ts'),rank=load('lib/battle-forfeit-rank.ts');
const players={host:{id:'a',name:'A',image:'/a.png',joinedAt:0},challenger:{id:'b',name:'B',image:'/b.png',joinedAt:0}};
const ledger=new Set(),scores=new Map();
const tx={$executeRawUnsafe:async(sql,...args)=>{if(sql.includes('INSERT INTO "BattleForfeitResult"')){if(ledger.has(args[0]))return 0;ledger.add(args[0]);return 1;}if(sql.includes('INSERT INTO "TriadRankProfile"')){const old=scores.get(args[0])||{wins:0,losses:0};old.wins+=args[3];old.losses+=args[4];scores.set(args[0],old);}return 0;}};
const src=fs.readFileSync('lib/triad-room-store.ts','utf8'),ast=ts.createSourceFile('triad.ts',src,ts.ScriptTarget.Latest,true);
const names=new Set(['leaveTriadRoom','joinTriadRoom','surrenderTriadRoom','persistRankedMatchIfNeeded','removeParticipant','withRoomMutationLock']);
const extracted=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.has(n.name?.text)).map(n=>n.getText(ast)).join('\n');
let stored;
const ctx=vm.createContext({exports:{},Date,globalForTriadRooms:{},cleanText:v=>String(v||'').trim(),getStoredRoom:async()=>stored?structuredClone(stored):null,deleteStoredRoom:async()=>{stored=null;},publicRoom:r=>structuredClone(r),isTriadBotParticipant:p=>p?.id==='bot',sideForParticipant:(r,id)=>['host','challenger'].find(s=>r.seats[s]?.id===id),prisma:{$transaction:async cb=>cb(tx)},recordForfeitRank:rank.recordForfeitRank,participantInStoredRoom:(r,id)=>[r.seats.host,r.seats.challenger,...r.spectators].some(p=>p?.id===id),SPECTATOR_LIMIT:10});
ctx.upsertStoredRoom=async room=>{await ctx.persistRankedMatchIfNeeded(room);stored=structuredClone(room);};
vm.runInContext(transpile(extracted),ctx);
(async()=>{
for(const loser of ['host','challenger']){
const winner=loser==='host'?'challenger':'host';scores.clear();ledger.clear();
stored={code:'123456',createdAt:1,hostId:'a',status:'playing',seats:structuredClone(players),spectators:[{id:'viewer'}],game:{deckStartedAt:2,matchEndedAt:0,rankedRecordedAt:0}};
await Promise.all([ctx.leaveTriadRoom('123456',players[loser].id),ctx.leaveTriadRoom('123456',players[loser].id)]);
assert.equal(stored.game.matchWinner,winner);assert.equal(stored.status,'playing');assert.equal(stored.seats[loser],null);assert.equal(stored.seats[winner].id,players[winner].id);assert.equal(scores.get(players[winner].id).wins,1);assert.equal(scores.get(players[loser].id).losses,1);assert.equal(ledger.size,1);
const rejected=await ctx.joinTriadRoom({code:'123456',participant:players[loser]});assert.equal(rejected.ok,false);
await ctx.surrenderTriadRoom('123456',players[winner].id);assert.equal(stored.game.matchWinner,winner,'Finished result is immutable');
await ctx.leaveTriadRoom('123456',players[winner].id);assert.equal(scores.get(players[winner].id).wins,1);
}
for(const loser of ['host','challenger'])for(const phase of ['deck','select','target','result']){
const winner=loser==='host'?'challenger':'host';const room=pentad.newPentadRoom('123456',players.host);room.seats.challenger=players.challenger;room.phase=phase;
pentad.applyPentadAction(room,players[loser],{action:'leave'},100);
assert.equal(room.phase,'finished');assert.equal(room.winner,winner);assert.equal(room.forfeit.winner.id,players[winner].id);assert.throws(()=>pentad.applyPentadAction(room,players[loser],{action:'join'}));const before=JSON.stringify(room.forfeit);pentad.applyPentadAction(room,players[loser],{action:'leave'});assert.equal(JSON.stringify(room.forfeit),before);
}
scores.clear();ledger.clear();const result={at:1,winner:players.host,loser:players.challenger};await Promise.all(Array.from({length:20},()=>rank.recordForfeitRank(tx,'same-match',result)));assert.equal(scores.get('a').wins,1);assert.equal(scores.get('b').losses,1);
const waiting=pentad.newPentadRoom('wait',players.host);waiting.seats.challenger=players.challenger;pentad.applyPentadAction(waiting,players.challenger,{action:'leave'});assert.equal(waiting.winner,'');
console.log('Forfeit: both Triad sides, concurrent/repeated leave, permanent outcome, blocked rejoin, all Pentad playing phases, waiting-room exclusion and exactly-once rank ledger passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
