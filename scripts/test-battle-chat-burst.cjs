const assert=require('node:assert/strict');
const load=require('./game-collection-test-loader.cjs')({'./prisma':{prisma:{}}});
const actor={id:'player:one',name:'Player',image:'/avatar.png'};
for(const mode of ['pentad','heptad']){
 const store=load(`lib/${mode}-room-store.ts`);
 const room=store[mode==='pentad'?'newPentadRoom':'newHeptadRoom']('123456',actor,1);
 const apply=store[mode==='pentad'?'applyPentadAction':'applyHeptadAction'];
 for(const phase of ['waiting','deck']){
  room.phase=phase;
  for(let i=0;i<30;i++)apply(room,actor,{action:'chat',text:`burst ${phase} ${i}`},1000);
 }
 const messages=mode==='pentad'?room.chat:room.lobby.chat;
 assert.equal(messages.length,60);
 assert.equal(new Set(messages.map(m=>m.id)).size,60);
 assert.ok(messages.every(m=>m.id.slice(0,m.id.lastIndexOf(':'))===actor.id));
 assert.equal(messages.at(-1).text,'burst deck 29');
 assert.throws(()=>apply(room,{id:'outsider',name:'Other'},{action:'chat',text:'forbidden'},1000));
 console.log(`${mode}: 60 rapid messages, same-millisecond IDs, order and room authorization passed`);
}
