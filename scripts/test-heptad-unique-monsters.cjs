const assert=require('node:assert/strict');
const load=require('./game-collection-test-loader.cjs')({'./prisma':{prisma:{}}});
const rules=load('lib/heptad-rules.ts'),store=load('lib/heptad-room-store.ts');
const blank=()=>Array.from({length:3},rules.emptyHeptadDeck);
for(const tier of ['all','bronze','silver-gold','silver','gold']){
 for(let i=0;i<10;i++){
  const decks=rules.completeHeptadMatchDeck(blank(),tier);
  const monsters=decks.flatMap(d=>[...d.monsters,...d.monsterReserve]);
  assert.equal(monsters.length,45);assert.equal(new Set(monsters).size,45);
  assert.ok(monsters.every(no=>rules.heptadMonsterAllowed(load('lib/triad-dominion.ts').triadCardByNo.get(no),tier)));
  assert.deepEqual(rules.validateHeptadMatchDeck(decks,tier),[]);
  const partial=blank();partial[2].monsterReserve=[monsters[0]];
  const filled=rules.completeHeptadMatchDeck(partial,tier);
  assert.equal(filled[2].monsterReserve[0],monsters[0]);
  assert.equal(new Set(filled.flatMap(d=>[...d.monsters,...d.monsterReserve])).size,45);
 }
}
assert.deepEqual(rules.HEPTAD_TIERS.map(t=>t.id),['bronze','silver-gold','all']);
for(const old of ['silver','gold']){
 const actor={id:'a',name:'A',image:''},room=store.newHeptadRoom('123456',actor);
 store.applyHeptadAction(room,actor,{action:'mode',tier:old});assert.equal(room.tier,'silver-gold');
 room.tier=old;assert.equal(store.publicHeptadRoom(room,actor.id).tier,'silver-gold');
}
const valid=rules.completeHeptadMatchDeck(blank(),'all');
for(const [fight,pile]of [[0,'monsters'],[0,'monsterReserve'],[1,'monsters'],[2,'monsterReserve']]){
 const duplicate=structuredClone(valid);duplicate[fight][pile][pile==='monsters'&&fight===0?1:0]=duplicate[0].monsters[0];
 assert.ok(rules.validateHeptadMatchDeck(duplicate,'all').some(e=>e.includes('ใช้มอนสเตอร์ได้ 1 ใบ')));
 assert.throws(()=>rules.completeHeptadMatchDeck(duplicate,'all'));
 const actor={id:'a',name:'A',image:''},room=store.newHeptadRoom('123456',actor);room.phase='deck';
 assert.throws(()=>store.applyHeptadAction(room,actor,{action:'ready',epoch:room.epoch,decks:duplicate}));
 assert.equal(room.ready.host,false);
}
console.log('HEPTAD: 45 unique monsters across 105 cards, reserves, all fights, partial autofill and server rejection passed');
