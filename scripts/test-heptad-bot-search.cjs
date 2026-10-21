const assert=require('node:assert/strict'),load=require('./game-collection-test-loader.cjs')({'./prisma':{prisma:{}}});
const s=load('lib/heptad-room-store.ts'),d=load('lib/triad-dominion.ts');
const r=s.newHeptadRoom('123456',{id:'a',name:'A',image:''});r.phase='select';r.turn=3;r.board={host:{1:'099',2:'177'},challenger:{1:'177',2:'099'}};
r.decks.host[0].skills=['232','270','018','235'];
const start=performance.now(),chosen=s.chooseHeptadBotCard(r,'host');assert.ok(r.decks.host[0].skills.includes(chosen));assert.ok(performance.now()-start<2000,'Bounded search must not stall room');
const changed=structuredClone(r);changed.decks.challenger[0].skills=['293','291'];changed.decks.challenger[0].monsterReserve=['001'];changed.picks.challenger='293';
assert.equal(s.chooseHeptadBotCard(changed,'host'),chosen,'Unrevealed enemy hand/pick cannot change decision');
for(const turn of [1,2,5,6,7]){const trial=structuredClone(r);trial.turn=turn;const pool=d.triadCards.filter(c=>c.kind===(turn===1||turn===2||turn===5?'monster':'skill')).slice(0,8).map(c=>c.cardNo);assert.ok(pool.includes(s.chooseHeptadBotCard(trial,'host',pool)));}
console.log('HEPTAD search: all turn types, legal picks, deterministic hidden-hand privacy and bounded time passed');
