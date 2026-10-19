const fs=require('node:fs'),assert=require('node:assert/strict'),load=require('./game-collection-test-loader.cjs')({
 './BattleParticles':{},'./BattleAudio':{},'./BattleTiming':{},'./BattleCinematic.module.css':{},
});
const triad=load('lib/triad-dominion.ts');
const {buildBattleSteps}=load('app/(main)/battle/triad-dominion/BattleCinematic.tsx');
for(const element of ['earth','water','wood','gold','fire'])for(const side of ['player','opponent'])for(const turn of [2,3]){
 const main={kind:'monster',element,cardNo:'001'},skill={kind:'skill',element:'fire',cardNo:'270'};
 const result={turn,skillEvents:[{side,cardNo:'270',summary:'legacy event',type:'stat'}]};
 const steps=buildBattleSteps(result,skill,skill,main,main);
 assert.equal(steps.some(s=>s.cardNo==='270'&&s.kind==='skill'),element==='fire'&&turn===3);
}
assert.ok(fs.readFileSync('components/BattlePlayerProfile.css','utf8').includes('height:36%'));
console.log('270 animation: invalid legacy events omitted for all non-fire mains and wrong turns, both sides passed');
