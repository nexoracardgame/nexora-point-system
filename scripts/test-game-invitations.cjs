const assert=require('node:assert/strict');
const rooms=new Map(),invitations=new Map();let active=null,friend=true,tail=Promise.resolve();
const db={
 $executeRawUnsafe:async(sql,...a)=>{
  if(sql.startsWith('CREATE'))return 0;
  if(sql.startsWith('INSERT INTO "GameInvitation"')){
   const [id,fromId,toId,senderName,senderImage,mode,code,roomCreatedAt,createdAt,expiresAt]=a;
   if(![...invitations.values()].some(i=>i.fromId===fromId&&i.toId===toId&&i.mode===mode&&i.code===code&&i.roomCreatedAt===roomCreatedAt))invitations.set(id,{id,fromId,toId,senderName,senderImage,mode,code,roomCreatedAt,createdAt,expiresAt,status:'pending'});return 1;
  }
  if(sql.startsWith('UPDATE "GameInvitation"')){invitations.get(a[0]).status=sql.includes("'accepted'")?'accepted':'declined';return 1;}
  const mode=sql.includes('"TriadRoom"')?'triad':sql.includes('"PentadRoom"')?'pentad':'heptad',row=rooms.get(mode+':'+a[0]);
  if(mode==='triad'){row.seats=JSON.parse(a[1]);row.spectators=JSON.parse(a[2]);}else row.data=JSON.parse(a[1]);return 1;
 },
 $queryRawUnsafe:async(sql,...a)=>{
  if(sql.includes('pg_advisory'))return [];
  if(sql.includes('FROM "GameInvitation"')){
   if(sql.includes('WHERE "id"'))return invitations.has(a[0])?[structuredClone(invitations.get(a[0]))]:[];
   return structuredClone([...invitations.values()].filter(i=>sql.includes('"fromId"=$1')?i.fromId===a[0]&&i.mode===a[1]&&i.code===a[2]&&i.roomCreatedAt===a[3]:i.toId===a[0]&&i.status==='pending'&&i.expiresAt>a[1]));
  }
  const mode=sql.includes('"TriadRoom"')?'triad':sql.includes('"PentadRoom"')?'pentad':'heptad';const row=rooms.get(mode+':'+a[0]);return row?[structuredClone(row)]:[];
 },
 $transaction:run=>{const next=tail.then(()=>run(db));tail=next.catch(()=>{});return next;},
};
const load=require('./game-collection-test-loader.cjs')({'./prisma':{prisma:db},'./friend-store':{getFriendRelation:async()=>({status:friend?'friends':'none'})},'./active-game-room':{findActiveGameRoom:async()=>active}});
const store=load('lib/game-invitation-store.ts');
const a={id:'a',name:'A',image:'/avatar.png'},b={id:'b',name:'B',image:'/avatar.png'},c={id:'c',name:'C',image:''};
let clock=1000;
function make(mode,seats={host:a,challenger:null},spectators=[],phase='waiting'){
 const common={code:'123456',createdAt:++clock,seats,spectators};const row=mode==='triad'?{...common,status:phase,game:{}}:{code:common.code,data:{...common,version:1,phase,...(mode==='heptad'?{lobby:{seats,spectators}}:{})}};rooms.set(mode+':123456',row);return row;
}
function lobby(mode){const row=rooms.get(mode+':123456');return mode==='triad'?row:mode==='heptad'?row.data.lobby:row.data;}
(async()=>{
 for(const mode of ['triad','pentad','heptad']){
  for(const seats of [{host:a,challenger:null},{host:null,challenger:a},{host:a,challenger:c}]){
   make(mode,seats,[{id:'first',name:'First',image:''}]);
   const invite=await store.createGameInvitation(a,'b',mode,'123456');
   assert.equal((await store.createGameInvitation(a,'b',mode,'123456')).id,invite.id,'Duplicate invite is idempotent');
   await assert.rejects(()=>store.respondGameInvitation(c,invite.id,true));
   await Promise.all([store.respondGameInvitation(b,invite.id,true),store.respondGameInvitation(b,invite.id,true)]);
   const room=lobby(mode),people=[...Object.values(room.seats),...room.spectators].filter(Boolean);
   assert.equal(people.filter(p=>p.id==='b').length,1,'Acceptance retries never duplicate membership');
   if(!seats.host||!seats.challenger)assert.ok(Object.values(room.seats).some(p=>p?.id==='b'));
   else assert.deepEqual(room.spectators.map(p=>p.id),['first','b']);
  }
  make(mode);let invite=await store.createGameInvitation(a,'b',mode,'123456');active={mode:'other',code:'999999'};await assert.rejects(()=>store.respondGameInvitation(b,invite.id,true));active=null;
  invitations.get(invite.id).expiresAt=0;await assert.rejects(()=>store.respondGameInvitation(b,invite.id,true));
  make(mode);invite=await store.createGameInvitation(a,'b',mode,'123456');await store.respondGameInvitation(b,invite.id,false);assert.equal(invitations.get(invite.id).status,'declined');assert.ok(!Object.values(lobby(mode).seats).some(p=>p?.id==='b'));
  make(mode);invite=await store.createGameInvitation(a,'b',mode,'123456');make(mode);await assert.rejects(()=>store.respondGameInvitation(b,invite.id,true),'Reused room code is not the invited room');
  friend=false;await assert.rejects(()=>store.createGameInvitation(a,'b',mode,'123456'));friend=true;
  make(mode);const [first,second]=await Promise.all([store.createGameInvitation(a,'b',mode,'123456'),store.createGameInvitation(a,'c',mode,'123456')]);
  await Promise.all([store.respondGameInvitation(b,first.id,true),store.respondGameInvitation(c,second.id,true)]);
  assert.equal(lobby(mode).seats.challenger.id,'b');assert.deepEqual(lobby(mode).spectators.map(p=>p.id),['c'],'Concurrent accepts use the latest locked seating');
  console.log(`${mode}: friends-only, idempotent invites, recipient authorization, both vacant seats, full-room spectator ordering, expiry and stale room passed`);
 }
})().catch(e=>{console.error(e);process.exitCode=1});
