const assert=require('node:assert/strict');
const load=require('./game-collection-test-loader.cjs')();
const {BattleCommandQueue}=load('lib/battle-command-queue.ts');
const {battleChatClearance}=load('lib/battle-chat-layout.ts');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
(async()=>{
 const queue=new BattleCommandQueue(),gate=deferred(),seen=[];
 const first=queue.enqueue(async()=>{seen.push('watch');await gate.promise;});
 const second=queue.enqueue(()=>seen.push('seat'));
 const superseded=queue.enqueue(()=>seen.push('old-mode'),'mode');
 const latest=queue.enqueue(()=>seen.push('latest-mode'),'mode');
 assert.equal(await superseded,false);
 assert.deepEqual(seen,['watch'],'dependent actions wait without being dropped');
 gate.resolve();await Promise.all([first,second,latest]);
 assert.deepEqual(seen,['watch','seat','latest-mode']);
 const failure=queue.enqueue(()=>{throw Error('conflict')});
 const after=queue.enqueue(()=>seen.push('after-error'));
 await assert.rejects(failure,/conflict/);await after;
 assert.equal(seen.at(-1),'after-error','failure does not lock remaining commands');
 const hold=deferred(),active=queue.enqueue(()=>hold.promise),cancelled=queue.enqueue(()=>seen.push('must-not-run'));
 queue.cancelPending();assert.equal(await cancelled,false);hold.resolve();await active;
 assert.ok(!seen.includes('must-not-run'),'leaving cancels unsent actions');
 for(const width of [568,844,1920,3840]){
  const cards=[{left:width*.12,right:width*.35,top:80,bottom:200},{left:width*.65,right:width*.88,top:80,bottom:200}];
  const space=battleChatClearance(width,140,190,cards,Math.min(440,width*.28));
  assert.ok(space.width>=120&&space.left>=0&&space.left+space.width<=width);
  for(const card of cards)assert.ok(space.left+space.width<=card.left||space.left>=card.right,'Chat avoids the two formations');
 }
 assert.equal(battleChatClearance(568,220,260,[{left:0,right:568,top:80,bottom:200}],200).left,12,'Cards outside the chat row do not move it');
 console.log('Battle queue: ordered mutations, latest mode coalescing, conflict recovery and departure cancellation passed');
 console.log('Battle chat: shared free-space placement avoids cards across landscape sizes');
})().catch(error=>{console.error(error);process.exitCode=1});
