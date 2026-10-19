const assert=require('node:assert/strict');
const load=require('./game-collection-test-loader.cjs')();
const triad=load('lib/triad-dominion.ts'),pentad=load('lib/pentad-dominion.ts');
const monster=element=>triad.triadCards.find(card=>card.kind==='monster'&&card.element===element&&card.support>0);
const fire=monster('fire'),water=monster('water');
for(const element of ['earth','water','wood','gold','fire'])for(const reversed of [false,true])for(const prioritySide of ['player','opponent']){
 const target=monster(element),caster={top:water.cardNo,right:'270'},victim={top:target.cardNo};
 const result=triad.resolveTriadTurn({turn:3,player:reversed?victim:caster,opponent:reversed?caster:victim,prioritySide});
 assert.equal(reversed?result.playerTotal:result.opponentTotal,element==='fire'?0:target.support,`270 must lock SUPPORT only on an opposing fire main: ${element}, reversed=${reversed}, priority=${prioritySide}`);
 assert.equal(result.skillEvents.some(event=>event.cardNo==='270'),element==='fire');
}
for(const turn of [1,2,3,4,5])for(const opener of ['host','challenger'])for(const element of ['earth','water','wood','gold','fire']){
 const target=monster(element);
 const input={fight:1,turn,mains:{host:water.cardNo,challenger:target.cardNo},skills:{host:'270',challenger:''},opener};
 const result=pentad.resolvePentadTurn(input),baseline=pentad.resolvePentadTurn({...input,skills:{host:'',challenger:''}});
 assert.equal(result.totals.challenger,element==='fire'&&turn>=4?0:baseline.totals.challenger,`Pentad turn ${turn}: ${element}, opener=${opener}`);
}
for(const reversed of [false,true]){
 const caster={top:water.cardNo,right:'270'},victim={top:water.cardNo,right:fire.cardNo};
 const result=triad.resolveTriadTurn({turn:3,player:reversed?victim:caster,opponent:reversed?caster:victim});
 assert.equal(reversed?result.playerTotal:result.opponentTotal,water.support+fire.support,'Fire on a support lane cannot satisfy the fire-main condition');
 const skipped=triad.resolveTriadTurn({turn:3,player:caster,opponent:{top:fire.cardNo},skippedSkillCardNos:['270']});assert.equal(skipped.opponentTotal,fire.support);
 const copied=triad.resolveTriadTurn({turn:3,player:{top:water.cardNo,right:'245'},opponent:{top:monster(reversed?'water':'fire').cardNo,right:'270'},skillTargets:{player:{245:'copy:270'}},prioritySide:'player'});
 assert.equal(copied.opponentTotal,reversed?water.support:0,'Copied 270 retains the target element condition');
}
const rule=triad.triadSkillRuleByNo.get('270');assert.equal(rule.target,'opponent-main');assert.equal(rule.blockedUseMetric,'support');assert.equal(rule.transformElement,undefined);
console.log('270: fire-main-only SUPPORT lock, all five elements, both sides/priority, every Pentad turn, off-main fire, skipped and copied skill passed');
