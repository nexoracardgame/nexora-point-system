const assert=require('node:assert/strict');
const load=require('./game-collection-test-loader.cjs')();
const {triadCards,resolveTriadTurn}=load('lib/triad-dominion.ts');
const {resolvePentadTurn}=load('lib/pentad-dominion.ts');
const {resolveHeptadClash}=load('lib/heptad-resolution.ts');
for(const card of triadCards.filter(c=>c.kind==='monster')){
 const loss=card.attack>=7000?3000:0;
 for(const target of ['player-top','bot-top']){
  const r=resolveTriadTurn({turn:2,player:{top:card.cardNo,left:'269'},opponent:{top:card.cardNo},skillTargets:{player:{'269':target}}});
  assert.equal(target==='player-top'?r.playerTotal:r.opponentTotal,card.attack-loss,`TRIAD ${card.cardNo}/${target}`);
  const p=resolvePentadTurn({fight:1,turn:3,mains:{host:card.cardNo,challenger:card.cardNo},skills:{host:'269',challenger:''},opener:'host',targets:{host:target,challenger:''}});
  assert.equal(p.totals[target==='player-top'?'host':'challenger'],card.attack-loss);
 }
 for(const target of ['player-top','bot-top','player-secondary','bot-secondary']){
  const r=resolveHeptadClash({board:{host:{1:card.cardNo,2:card.cardNo},challenger:{1:card.cardNo,2:card.cardNo}},turn:3,opener:'host',casts:[{side:'host',cardNo:'269',target,kind:'normal'}],seed:'269'});
  assert.equal(r.totals[target.startsWith('player')?'host':'challenger'],card.attack*2-loss,`HEPTAD ${card.cardNo}/${target}`);
 }
}
// Conditions use the target's current power, not the sum of main and branch.
const card=triadCards.find(c=>c.kind==='monster'&&c.attack===7000);
assert.ok(card,'exact 7000 boundary is covered');
const r=resolveTriadTurn({turn:2,player:{top:card.cardNo,left:'269'},opponent:{top:card.cardNo},contributionValues:{opponent:{top:6999}},skillTargets:{player:{'269':'bot-top'}}});
assert.ok(r.skillEvents.some(e=>e.cardNo==='269'&&e.blocked));
console.log('269: all monsters, exact 7000 boundary, own/enemy main and secondary, all three modes passed');
