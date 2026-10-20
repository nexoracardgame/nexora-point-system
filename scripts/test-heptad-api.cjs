const assert=require('node:assert/strict');
let actor=null,tail=Promise.resolve(),rankWrites=0;
const rows=new Map(),ledger=new Set();
const prisma={
 $executeRawUnsafe:async(sql,...args)=>{
  if(sql.startsWith('CREATE TABLE'))return 0;
  if(sql.includes('INSERT INTO "HeptadRoom"')){if(rows.has(args[0]))return 0;rows.set(args[0],JSON.parse(args[1]));return 1;}
  if(sql.includes('UPDATE "HeptadRoom"')){rows.set(args[0],JSON.parse(args[1]));return 1;}
  if(sql.includes('DELETE FROM "HeptadRoom"')){rows.delete(args[0]);return 1;}
  if(sql.includes('INSERT INTO "BattleForfeitResult"')){if(ledger.has(args[0]))return 0;ledger.add(args[0]);return 1;}
  if(sql.includes('INSERT INTO "TriadRankProfile"')){rankWrites++;return 1;}
  throw Error('Unexpected write '+sql);
 },
 $queryRawUnsafe:async(sql,...args)=>{
  if(sql.includes('FROM "TriadRoom"')||sql.includes('FROM "PentadRoom"'))return [];
  if(sql.includes('FROM "HeptadRoom"')){
   if(sql.includes('SELECT "code","updatedAt"'))return [...rows.values()].filter(r=>r.phase!=='finished'&&Object.values(r.lobby.seats).some(p=>p?.id===args[0])).map(r=>({code:r.code,updatedAt:new Date(r.updatedAt)}));
   if(sql.includes('code=$1'))return rows.has(args[0])?[{data:structuredClone(rows.get(args[0]))}]:[];
   return [...rows.values()].map(data=>({data:structuredClone(data)}));
  }
  throw Error('Unexpected read '+sql);
 },
 $transaction:run=>{const promise=tail.then(()=>run(prisma));tail=promise.catch(()=>{});return promise;},
};
const load=require('./game-collection-test-loader.cjs')({
 './prisma':{prisma},'@/lib/prisma':{prisma},
 'next/server':{NextResponse:{json:(body,options)=>new Response(JSON.stringify(body),options)},after:()=>{}},
 '@/lib/admin-auth':{getApiActor:async()=>actor},'@/lib/supabase-server':{getServerSupabaseClient:()=>null},
});
const route=load('app/api/heptad-rooms/route.ts');
const rules=load('lib/heptad-rules.ts');
const people={a:{id:'a',name:'A',image:'/avatar.png'},b:{id:'b',name:'B',image:'/avatar.png'},c:{id:'c',name:'C',image:'/avatar.png'}};
async function post(user,body){actor=people[user]||null;const result=await route.POST(new Request('http://api.test/api/heptad-rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:result.status,...await result.json()};}
async function get(user,code){actor=people[user]||null;const result=await route.GET(new Request('http://api.test/api/heptad-rooms'+(code?'?room='+code:'')));return {status:result.status,...await result.json()};}
(async()=>{
 assert.equal((await get('none')).status,401);
 const created=await post('a',{action:'create',access:'private',password:'secret'});assert.equal(created.status,200);const code=created.room.code;
 assert.equal(created.room.lobby.passwordHash,undefined);
 assert.equal((await get('c',code)).status,409,'GET requires actual membership');
 assert.equal((await post('b',{action:'join',code,password:'wrong'})).status,409);
 assert.equal((await get('b')).rooms.length,0,'Private room omitted from listings');
 assert.equal((await post('b',{action:'join',code,password:'secret'})).status,200);
 assert.equal((await post('a',{action:'create'})).status,409,'Cannot create a second active room');
 assert.equal((await post('b',{action:'start',code})).status,409);
 assert.equal((await post('a',{action:'start',code})).status,200);
 let r=rows.get(code);const epoch=r.epoch;
 const body={action:'ready',code,epoch,decks:rules.completeHeptadMatchDeck(Array.from({length:3},rules.emptyHeptadDeck),'all')};
 assert.equal((await post('a',body)).status,200);assert.equal((await post('b',body)).status,200);
 r=rows.get(code);assert.equal(r.phase,'select');
 const store=load('lib/heptad-room-store.ts');
 // Two concurrent mutations go through row-transaction serialization.
 await Promise.all([store.mutateHeptadRoom(code,people.a,{action:'pick',epoch:r.epoch,cardNo:store.heptadAvailable(r,'host')[0]}),store.mutateHeptadRoom(code,people.b,{action:'pick',epoch:r.epoch,cardNo:store.heptadAvailable(r,'challenger')[0]})]);
 assert.equal(rows.get(code).phase,'result');
 const stale=await post('a',{action:'pick',code,epoch,cardNo:body.decks[0].monsters[1]});
 assert.equal(stale.status,200);assert.equal(stale.ignored,true,'Stale commands refresh without a disruptive error');
 assert.equal(stale.room.phase,'result','Stale commands cannot change the new round');
 assert.equal((await get('b',code)).room.decks.host.length,0,'Opponent decks never cross the API');
 assert.equal((await post('a',{action:'leave',code})).status,200);
 assert.equal(rankWrites,2);assert.equal(rows.get(code).winner,'challenger');
 assert.equal((await post('a',{action:'leave',code})).status,200);assert.equal(rankWrites,2,'Repeated departure cannot award rank twice');
 assert.equal((await post('a',{action:'join',code,password:'secret'})).status,409,'Forfeit loser cannot rejoin');
 console.log('HEPTAD API: auth, private passwords, room isolation, serialized picks, stale epochs, privacy and exactly-once rank passed');
})().catch(error=>{console.error(error);process.exitCode=1});
