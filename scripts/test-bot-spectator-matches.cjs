const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const path=require('node:path'),cache=new Map();
const prisma={$executeRawUnsafe:async()=>0,$queryRawUnsafe:async()=>[]};
function load(file){const full=path.resolve(file);if(cache.has(full))return cache.get(full).exports;const m={exports:{}};cache.set(full,m);const src=ts.transpileModule(fs.readFileSync(full,'utf8'),{fileName:full,compilerOptions:{module:1,target:9,esModuleInterop:true}}).outputText;new Function('require','module','exports',src)(id=>id==='./prisma'||id==='@/lib/prisma'?{prisma:{}}:id.startsWith('@/')?(id.endsWith('.json')?require(path.resolve(id.slice(2))):load(id.slice(2)+'.ts')):id.startsWith('.')?load(path.resolve(path.dirname(full),id+'.ts')):require(id),m,m.exports);return m.exports}
const file='lib/triad-room-store.ts',mod={exports:{}};
const source=fs.readFileSync(file,'utf8')+'\nexport {runSeatBots,freshGame,triadBotParticipant,buildSelectionPools};';
new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:1,target:9,esModuleInterop:true}}).outputText)(id=>id==='./prisma'||id==='@/lib/prisma'?{prisma}:id.startsWith('./')?load('lib/'+id.slice(2)+'.ts'):id.startsWith('@/')?load(id.slice(2)+'.ts'):require(id),mod,mod.exports);
const triad=mod.exports,pentad=load('lib/pentad-room-store.ts');
const owner={id:'human-owner',name:'Owner',image:'/avatar.png',joinedAt:1},visitor={id:'visitor',name:'Visitor',image:'/avatar.png'};
let now=Date.now();const realNow=Date.now;Date.now=()=>now;
try{
 for(const deckMode of ['all','monster','skill']){
  const room={code:'bot-'+deckMode,hostId:owner.id,seats:{host:triad.triadBotParticipant(),challenger:triad.triadBotParticipant()},spectators:[owner],status:'playing',createdAt:now,updatedAt:now,game:{...triad.freshGame(),deckMode,selectionPools:triad.buildSelectionPools(deckMode,'test')}};
  let resolved=0;
  for(let tick=0;tick<180&&!room.game.matchEndedAt;tick++){
   now+=13000;triad.runSeatBots(room);resolved=Math.max(resolved,room.game.fightNo*3+room.game.activeTurn);
  }
  assert.ok(room.game.matchEndedAt,`TRIAD ${deckMode}: bots complete without a seated human, progress=${resolved}`);
  assert.equal(room.spectators[0].id,owner.id);assert.equal(room.hostId,owner.id);
  assert.equal(room.game.deckReady.host,true);assert.equal(room.game.deckReady.challenger,true);
  console.log(`TRIAD ${deckMode}: two bots complete match while owner spectates`);
 }
 for(const deckSource of ['all','random']){
  const room=pentad.newPentadRoom('pentad-'+deckSource,owner,now);room.deckSource=deckSource;
  pentad.applyPentadAction(room,owner,{action:'watch'},now);assert.equal(room.seats.host,null);assert.equal(room.ownerId,owner.id);
  const occupied=structuredClone(room);occupied.seats.host=visitor;assert.throws(()=>pentad.applyPentadAction(occupied,owner,{action:'bot',seat:'host',enabled:true},now));assert.equal(occupied.seats.host.id,visitor.id);
  pentad.applyPentadAction(room,owner,{action:'bot',seat:'host',enabled:true},now);
  pentad.applyPentadAction(room,owner,{action:'bot',seat:'challenger',enabled:true},now);
  room.spectators.push(visitor);
  assert.throws(()=>pentad.applyPentadAction(room,visitor,{action:'bot',seat:'host',enabled:false},now));
  assert.throws(()=>pentad.applyPentadAction(room,visitor,{action:'start'},now));
  pentad.applyPentadAction(room,owner,{action:'bot',seat:'host',enabled:false},now);assert.equal(room.seats.host,null);
  pentad.applyPentadAction(room,owner,{action:'bot',seat:'host',enabled:true},now);
  pentad.applyPentadAction(room,owner,{action:'start'},now);
  for(let tick=0;tick<300&&room.phase!=='finished';tick++){now+=60000;pentad.tickPentadRoom(room,now)}
  assert.equal(room.phase,'finished',`PENTAD ${deckSource}: completes bot vs bot`);assert.ok(room.rounds.length);assert.equal(room.spectators[0].id,owner.id);
  console.log(`PENTAD ${deckSource}: owner spectator permissions, independent bot seats, full match passed`);
 }
}finally{Date.now=realNow}
