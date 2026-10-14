const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
require('dotenv').config({quiet:true});
const {PrismaClient}=require('@prisma/client');
const prisma=new PrismaClient();const cache={};
function load(file){if(cache[file])return cache[file].exports;const module=cache[file]={exports:{}};const localRequire=id=>id==='./prisma'?{prisma}:id==='@/public/cards/card-skill-db.json'?require('../public/cards/card-skill-db.json'):id.startsWith('./')?load('lib/'+id.slice(2)+'.ts'):require(id);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;vm.runInThisContext(`(function(require,module,exports){${code}\n})`,{filename:file})(localRequire,module,module.exports);return module.exports;}
const store=load('lib/pentad-room-store.ts'),rules=load('lib/pentad-dominion.ts');
const host={id:'pentad-test:'+randomUUID(),name:'PENTAD QA HOST',image:'/avatar.png'},challenger={id:'pentad-test:'+randomUUID(),name:'PENTAD QA RIVAL',image:'/avatar.png'},spectator={id:'pentad-test:'+randomUUID(),name:'PENTAD QA VIEWER',image:'/avatar.png'};
let code;
(async()=>{
try{
  let room=await store.createPentadRoom(host);code=room.code;
  await store.mutatePentadRoom(code,challenger,{action:'join'});
  await store.mutatePentadRoom(code,spectator,{action:'join',spectate:true});
  room=await store.mutatePentadRoom(code,host,{action:'start'});
  assert.equal(room.phase,'deck');const epoch=room.epoch;
  const [a,b]=await Promise.all([
    store.mutatePentadRoom(code,host,{action:'ready',epoch,deck:rules.completePentadDeck(rules.emptyPentadDeck())}),
    store.mutatePentadRoom(code,challenger,{action:'ready',epoch,deck:rules.completePentadDeck(rules.emptyPentadDeck())})
  ]);
  room=await store.mutatePentadRoom(code,host);
  assert.equal(room.phase,'select');assert.equal(room.epoch,epoch+1);assert.ok(room.ready.host&&room.ready.challenger);
  const opponent=await store.mutatePentadRoom(code,challenger);
  const cardA=room.decks.host.monsters[0],cardB=opponent.decks.challenger.monsters[0];
  assert.equal(room.decks.challenger.monsters.length,0);assert.equal(opponent.decks.host.monsters.length,0);
  await Promise.all([
    store.mutatePentadRoom(code,host,{action:'pick',epoch:room.epoch,cardNo:cardA}),
    store.mutatePentadRoom(code,challenger,{action:'pick',epoch:room.epoch,cardNo:cardB})
  ]);
  room=await store.mutatePentadRoom(code,host);
  assert.ok(['target','result'].includes(room.phase));
  const reconnect=await store.mutatePentadRoom(code,host);assert.equal(reconnect.phase,room.phase);
  const viewer=await store.mutatePentadRoom(code,spectator);assert.equal(viewer.decks.host.monsters.length,0);assert.equal(viewer.decks.challenger.hand.length,0);
  await assert.rejects(()=>store.mutatePentadRoom(code,{id:'intruder',name:'INTRUDER',image:''}),/เข้าร่วมห้อง/);
  await assert.rejects(()=>store.mutatePentadRoom(code,host,{action:'pick',epoch,cardNo:cardA}),/ตาก่อน/);
  const before=JSON.stringify((await prisma.$queryRawUnsafe('SELECT "data" FROM "PentadRoom" WHERE "code"=$1',code))[0].data);
  await store.mutatePentadRoom(code,host);
  const after=JSON.stringify((await prisma.$queryRawUnsafe('SELECT "data" FROM "PentadRoom" WHERE "code"=$1',code))[0].data);
  assert.equal(before,after,'Idle polls do not write or churn room versions');
  let steps=0;
  while(room.phase!=='finished' && steps++<100) {
    await prisma.$executeRawUnsafe(`UPDATE "PentadRoom" SET "data" = jsonb_set(jsonb_set("data", '{deadline}', to_jsonb($2::bigint)), '{choices}', COALESCE((SELECT jsonb_agg(jsonb_set(choice, '{deadline}', to_jsonb($2::bigint))) FROM jsonb_array_elements("data"->'choices') AS choice), '[]'::jsonb)) WHERE "code"=$1 AND "data"->'seats'->'host'->>'id'=$3`,code,Date.now()-1,host.id);
    room=await store.mutatePentadRoom(code,host);
  }
  assert.equal(room.phase,'finished','Online match advances through all phases');assert.ok(room.score.host+room.score.challenger<=15);
  console.log('Live PostgreSQL Pentad: create, simultaneous ready/picks, row-lock safety, reconnect, viewer privacy, authorization and idle reads passed');
}finally{
  if(code)await prisma.$executeRawUnsafe('DELETE FROM "PentadRoom" WHERE "code"=$1 AND "data"->\'seats\'->\'host\'->>\'id\'=$2',code,host.id);
  await prisma.$disconnect();
}
})().catch(error=>{console.error(error.message);process.exitCode=1});
