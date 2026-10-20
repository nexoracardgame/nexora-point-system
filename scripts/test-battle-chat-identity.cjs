const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const m={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/battle-chat-messages.ts','utf8'),{compilerOptions:{module:1,target:9}}).outputText)(m,m.exports);
const {reconcileBattleChat,deliveredBattleChat}=m.exports;
let state={key:'room',pending:[],aliases:{}},confirmed=[];
for(let i=0;i<30;i++)state.pending.push({id:'pending-'+i,senderId:'a',senderName:'A',text:'same',createdAt:100+i,baseline:new Set()});
const identities=deliveredBattleChat(confirmed,state).map(item=>item.id);
for(let i=0;i<30;i++){
 confirmed.push({id:'server-'+i,senderId:'a',senderName:'A',text:'same',createdAt:1000+i});
 state=reconcileBattleChat(confirmed,state);
 assert.equal(state.pending.length,29-i,'Each echo acknowledges exactly one row');
 assert.deepEqual(deliveredBattleChat(confirmed,state).map(item=>item.id),identities,'Acknowledgements never replace or reorder optimistic DOM keys');
 assert.equal(reconcileBattleChat(confirmed,state),state,'Repeated snapshots are idempotent');
}
state=reconcileBattleChat([],state);
assert.equal(deliveredBattleChat([],state).length,0,'Evicted history does not resurrect pending rows');
console.log('30 identical in-flight messages: stable identities, one-to-one acknowledgements, ordering and eviction passed');
