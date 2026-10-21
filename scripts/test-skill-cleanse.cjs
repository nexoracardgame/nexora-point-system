const assert=require('node:assert/strict'),load=require('./game-collection-test-loader.cjs')();
const {triadCards,triadCardByNo,resolveTriadTurn}=load('lib/triad-dominion.ts');
for(const [no,element]of [['228','earth'],['237','gold'],['252','water'],['275','fire']]){
 const monster=triadCards.find(c=>c.kind==='monster'&&c.element===element);
 for(const prioritySide of ['player','opponent']){
  const result=resolveTriadTurn({turn:2,player:{top:monster.cardNo,left:no},opponent:{top:monster.cardNo,left:'232'},prioritySide,skillTargets:{player:{[no]:'player-top'},opponent:{'232':'player-top>bot-top'}}});
  assert.equal(result.playerTotal,monster.attack,`${no}: cancels loss whether played before or after debuff`);
 }
}
const monster=triadCards.find(c=>c.kind==='monster'&&c.element==='gold');
for(const prioritySide of ['player','opponent']){
 const result=resolveTriadTurn({turn:2,player:{top:monster.cardNo,left:'235'},opponent:{top:monster.cardNo,left:'232'},prioritySide,skillTargets:{player:{'235':'bot-top'},opponent:{'232':'player-top>bot-top'}}});assert.equal(result.opponentTotal,monster.attack,'235 cancels gains before and after');
}
const nonwood=triadCards.find(c=>c.kind==='monster'&&c.element!=='wood'&&c.attack!==c.support);
const swap=resolveTriadTurn({turn:2,player:{top:nonwood.cardNo,left:'285'},opponent:{top:nonwood.cardNo},prioritySide:'player',skillTargets:{player:{'285':'player-top'}}});assert.equal(swap.playerTotal,nonwood.support);
assert.equal(triadCardByNo.get('228').name,'โล่ธาตุดิน');assert.equal(triadCardByNo.get('252').name,'คลื่นล้างพิษ');assert.equal(triadCardByNo.get('290').name,'ตรารากพันธะ');assert.ok(triadCardByNo.get('289').skillText.includes('กลายเป็น ธาตุดิน'));
console.log('Image-verified cleansing: losses/gains removed before or after casts, stat swap and corrected card names/elements passed');
const {resolveHeptadClash}=load('lib/heptad-resolution.ts');
const gold=triadCards.find(c=>c.kind==='monster'&&c.element==='gold');
for(const order of ['before','after']){
 const board={host:{1:gold.cardNo,2:gold.cardNo},challenger:{1:gold.cardNo,2:gold.cardNo}};
 const seal={side:'challenger',cardNo:'232',target:'player-top>bot-top',kind:order==='before'?'normal':'special'};
 const cleanse={side:'host',cardNo:'237',target:'player-top',kind:order==='before'?'special':'normal'};
 const r=resolveHeptadClash({board,turn:3,opener:'challenger',casts:order==='before'?[cleanse,seal]:[seal,cleanse],seed:'cleanse-batches'});
 assert.equal(r.totals.host,gold.attack*2,`HEPTAD cleanse ${order} special/normal batch persists within turn`);
}
