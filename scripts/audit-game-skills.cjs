const fs=require('node:fs'),assert=require('node:assert/strict');
const load=require('./game-collection-test-loader.cjs')();
const data=load('lib/triad-dominion.ts'),{botSkillTargets}=load('lib/battle-bot-search.ts');
const raw=require('../public/cards/card-skill-db.json');const records=Array.isArray(raw)?raw:raw.cards;
const monsters=data.triadCards.filter(card=>card.kind==='monster');
const samples=['earth','water','wood','fire','gold'].map(element=>monsters.find(card=>card.element===element));
const report=[];let cases=0;
for(const rule of data.triadSkillRules){
 const card=data.triadCardByNo.get(rule.cardNo),source=records.find(item=>item.cardNo===rule.cardNo);assert.ok(source&&card);
 const unresolved=new Set(),summaries=new Set();
 for(const turn of [2,3])for(const monster of samples){
  const lane=turn===2?'left':'right',own={top:monster.cardNo,[lane]:rule.cardNo},enemy={top:samples[(samples.indexOf(monster)+1)%samples.length].cardNo};
  for(const target of botSkillTargets(rule.cardNo,own,enemy)){
   const before=JSON.stringify({own,enemy});const result=data.resolveTriadTurn({turn,player:enemy,opponent:own,prioritySide:'opponent',skillTargets:{opponent:{[rule.cardNo]:target}},randomMonsterSeed:'audit'});
   assert.ok(Number.isFinite(result.playerTotal)&&Number.isFinite(result.opponentTotal));assert.equal(JSON.stringify({own,enemy}),before);
   result.unresolvedSkills.forEach(item=>unresolved.add(item.cardNo));result.skillEvents.filter(event=>event.cardNo===rule.cardNo).forEach(event=>summaries.add(event.summary));cases++;
  }
 }
 report.push({cardNo:rule.cardNo,name:card.name,text:card.skillText,sourceName:source.cardName,sourceText:source.skill,sourceMatches:card.name===source.cardName&&card.skillText===source.skill,needsReview:rule.needsReview,unresolved:[...unresolved],summaries:[...summaries],visualVerification:'pending-image-by-image-review'});
}
fs.mkdirSync('artifacts/skill-audit',{recursive:true});fs.writeFileSync('artifacts/skill-audit/report.json',JSON.stringify({cards:report.length,cases,report},null,2));
console.log(JSON.stringify({cards:report.length,cases,sourceMismatches:report.filter(r=>!r.sourceMatches).map(r=>r.cardNo),unresolved:report.filter(r=>r.unresolved.length).map(r=>({no:r.cardNo,name:r.name,text:r.text})),visualReview:'Not yet verified against every card image'},null,2));
