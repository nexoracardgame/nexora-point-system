const assert=require('node:assert/strict');
const loader=require('./game-collection-test-loader.cjs');
(async()=>{
 let rankReads=0;
 const load=loader({
  '@/lib/prisma':{prisma:{user:{findUnique:async()=>({id:'live',name:'Player',image:'/avatar.png'})}}},
  '@/lib/game-profile-store':{readGameAppearance:async()=>({avatar:'',frame:'gold',hero:'gold'})},
  '@/lib/triad-room-store':{readTriadRankStats:async id=>{assert.equal(id,'live');rankReads++;return{wins:32,losses:8}},rankForWins:wins=>({rankName:wins>=50?'Master':'Diamond',nextRankWins:wins>=50?null:50})},
  '@/lib/local-profile-store':{getLocalProfileByUserId:async()=>({displayName:'Live Name'})},
 });
 const details=await load('lib/game-profile-details.ts').readGameProfileDetails('live');
 assert.equal(rankReads,1);assert.deepEqual(details.stats,{wins:32,losses:8});assert.equal(details.rank.name,'Diamond');
 const originalFetch=global.fetch,originalNow=Date.now;
 try{
  const client=loader({'./game-profile-options':{gameHeroes:[]}})('lib/game-profile-client.ts');
  let calls=0;global.fetch=async()=>{calls++;return calls<3?new Response('{}',{status:503}):Response.json(details)};
  const [a,b]=await Promise.all([client.loadGameProfile('live'),client.loadGameProfile('live')]);
  assert.equal(calls,3);assert.equal(a,b);assert.equal(a.rank.name,'Diamond');
  Date.now=()=>originalNow()+60000;calls=0;global.fetch=async()=>{calls++;return new Response('{}',{status:503})};
  const stale=await client.loadGameProfile('live');assert.equal(calls,3);assert.deepEqual(stale.stats,{wins:32,losses:8});
  calls=0;global.fetch=async()=>{calls++;return new Response('{}',{status:401})};
  await assert.rejects(()=>client.loadGameProfile('other'));assert.equal(calls,1);assert.equal(client.cachedGameProfile('other'),undefined);
  console.log('Profile readiness: schema-aware rank reader, deduplicated preload, bounded retry, verified stale data fallback, no invented stats or cross-user fallback passed');
 }finally{global.fetch=originalFetch;Date.now=originalNow}
})().catch(error=>{console.error(error);process.exitCode=1});
