const assert=require('node:assert/strict');
const load=require('./game-collection-test-loader.cjs')();
const {triadCards,resolveTriadTurn}=load('lib/triad-dominion.ts');
const {resolvePentadTurn}=load('lib/pentad-dominion.ts');
const {resolveHeptadClash}=load('lib/heptad-resolution.ts');
const monster=triadCards.find(c=>c.kind==='monster'&&c.attack>=3000);
for(const caster of ['player','opponent']){
 const own=caster==='player'?'player-top':'bot-top',enemy=caster==='player'?'bot-top':'player-top';
 const input={turn:2,player:{top:monster.cardNo,left:caster==='player'?'232':'',right:''},opponent:{top:monster.cardNo,left:caster==='opponent'?'232':'',right:''},prioritySide:caster,skillTargets:{[caster]:{'232':`${enemy}>${own}`}}};
 const r=resolveTriadTurn(input);assert.equal(r[caster==='player'?'playerTotal':'opponentTotal'],monster.attack+2000);assert.equal(r[caster==='player'?'opponentTotal':'playerTotal'],monster.attack-2000);
 for(const target of [own,`${own}>${own}`]){const invalid=resolveTriadTurn({...input,skillTargets:{[caster]:{'232':target}}});assert.equal(invalid.playerTotal,monster.attack);assert.equal(invalid.opponentTotal,monster.attack);}
}
for(const caster of ['host','challenger']){
 const own=caster==='host'?'player-top':'bot-top',enemy=caster==='host'?'bot-top':'player-top';
 const r=resolvePentadTurn({fight:1,turn:2,mains:{host:monster.cardNo,challenger:monster.cardNo},skills:{host:caster==='host'?'232':'',challenger:caster==='challenger'?'232':''},opener:caster,targets:{host:caster==='host'?`${enemy}>${own}`:'',challenger:caster==='challenger'?`${enemy}>${own}`:''}});
 assert.equal(r.totals[caster],monster.attack+2000);
 for(const turn of [3,4]){const board={host:{1:monster.cardNo,2:monster.cardNo},challenger:{1:monster.cardNo,2:monster.cardNo}};const result=resolveHeptadClash({board,turn,opener:caster,casts:[{side:caster,cardNo:'232',kind:'normal',target:`${enemy}>${own}`}],seed:'232'});assert.equal(result.totals[caster],monster.attack*2+2000);}
}
console.log('232: both caster sides, ordered drain/boost, invalid duplicate targets, TRIAD/PENTAD/HEPTAD attack turns passed');
