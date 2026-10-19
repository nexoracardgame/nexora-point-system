const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:1,target:9}}).outputText;
const chatModule={exports:{}};new Function('require','module','exports',compile('lib/battle-chat-messages.ts'))(require,chatModule,chatModule.exports);
assert.equal(chatModule.exports.visibleBattleChat([{id:'server',senderId:'a',senderName:'A',text:'hello  there'}],[{id:'pending',senderId:'a',senderName:'A',text:'hello there',baseline:new Set()}]).length,1,'Whitespace normalization cannot duplicate a Pentad echo');
let actor={id:'member'},databaseError=false;const queries=[];
const moduleUnderTest={exports:{}};
new Function('require','module','exports',compile('app/api/battle-chat/route.ts'))(id=>({
 'next/server':require('next/server'),
 '@/lib/admin-auth':{getApiActor:async()=>actor},
 '@/lib/prisma':{prisma:{$queryRawUnsafe:async(sql,code,id)=>{queries.push({sql,code,id});if(databaseError)throw Error('secret database details');if(id!=='member')return[];return[{messages:sql.includes('TriadRoom')?[{id:'triad-message',senderId:'member',senderName:'Name',text:'Hello',createdAt:100}]:[{id:'member:100',name:'Name',text:'Hello',at:100}]}]}}},
 }[id]||require(id)),moduleUnderTest,moduleUnderTest.exports);
const get=(mode='triad',code='123456')=>moduleUnderTest.exports.GET(new Request(`http://localhost/api/battle-chat?mode=${mode}&room=${code}`));
(async()=>{
 for(const mode of ['triad','pentad']){
  const response=await get(mode),data=await response.json();assert.equal(response.status,200);assert.equal(data.messages[0].senderId,'member');assert.equal(data.messages[0].createdAt,100);assert.equal(data.messages[0].text,'Hello');assert.deepEqual(Object.keys(data),['messages']);assert.ok(response.headers.get('Cache-Control').includes('no-store'));
  const q=queries.at(-1);assert.equal(q.code,'123456');assert.equal(q.id,'member');for(const term of ['host','challenger','spectators','$2'])assert.ok(q.sql.includes(term));assert.ok(!q.sql.includes('FOR UPDATE'));assert.ok(!q.sql.includes('SELECT *'));
 }
 actor=null;const count=queries.length;assert.equal((await get()).status,401);assert.equal(queries.length,count);
 actor={id:'outsider'};assert.equal((await get('pentad')).status,403);
 actor={id:'member'};assert.equal((await get('invalid')).status,400);assert.equal((await get('triad','invalid')).status,400);
 databaseError=true;const unavailable=await get();assert.equal(unavailable.status,503);assert.ok(!JSON.stringify(await unavailable.json()).includes('secret'));
 console.log('Fast battle chat API: authentication, both room membership checks, no-store, message-only unlocked reads, input validation and safe failure passed');
})().catch(e=>{console.error(e);process.exitCode=1});
