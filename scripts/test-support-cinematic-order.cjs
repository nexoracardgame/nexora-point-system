const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const output=ts.transpileModule(fs.readFileSync('app/(main)/battle/triad-dominion/BattleCinematic.tsx','utf8'),{compilerOptions:{module:1,target:9,jsx:4}}).outputText;
const m={exports:{}};
new Function('require','module','exports',output)(id=>id==='@/lib/triad-dominion'?{triadSkillRuleByNo:new Map([['018',{target:'own-main',effects:[{delta:2000}]}]])}:{},m,m.exports);
const {buildBattleSteps}=m.exports;
const main={cardNo:'007',kind:'monster'},secondary={cardNo:'008',kind:'monster'};
const base={turn:2,metric:'attack',prioritySide:'player',winner:'player',playerTotal:12000,opponentTotal:10000,skillEvents:[],cinematicSupport:{player:'008',opponent:'009'}};
for(const side of ['player','opponent']){
 const result={...base,skillEvents:[{side,cardNo:'018',summary:'buff secondary',targetLabel:'มอนสเตอร์รองฝ่ายผู้ใช้สกิล'}]};
 const steps=buildBattleSteps(result,secondary,secondary,main,main);
 const skill=steps.findIndex(step=>step.cardNo==='018'),transfer=steps.findIndex(step=>step.supportTransfer&&step.side===side);
 assert.ok(skill<transfer,'Secondary receives its skill before sending power');
 assert.ok(steps.filter(step=>step.kind==='strike').every(step=>step.cardNo==='007'),'Main monster strikes with combined power');
 assert.equal(steps[skill].secondaryTarget,true);
}
const mainOnly=buildBattleSteps({...base,skillEvents:[{side:'player',cardNo:'018',summary:'main',targetLabel:'มอนสเตอร์หลักฝ่ายผู้ใช้สกิล'}]},secondary,secondary,main,main);
assert.ok(mainOnly.findIndex(step=>step.supportTransfer&&step.side==='player')<mainOnly.findIndex(step=>step.cardNo==='018'),'Without secondary-targeted effects, support transfer precedes main buff');
const blocked=buildBattleSteps({...base,skillEvents:[{side:'player',cardNo:'018',blocked:true,summary:'blocked',targetLabel:'มอนสเตอร์รองฝ่ายผู้ใช้สกิล'}]},secondary,secondary,main,main);
assert.ok(blocked.findIndex(step=>step.supportTransfer)<blocked.findIndex(step=>step.cardNo==='018'),'Blocked effects cannot delay support');
console.log('Both sides: secondary skill precedes transfer, main-only buff follows transfer, blocked effect and main strike ordering passed');
