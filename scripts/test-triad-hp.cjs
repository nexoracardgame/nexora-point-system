const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const source = fs.readFileSync('app/(main)/battle/triad-dominion/BattleCinematic.tsx','utf8');
const ast = ts.createSourceFile('cinematic.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names = new Set(['buildBattleSteps','battleHpAtStep','battleEmpowermentAtStep']);
const code = ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.has(n.name?.text)).map(n=>n.getText(ast)).join('\n');
const context = vm.createContext({exports:{},triadSkillRuleByNo:new Map()});
vm.runInContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
const timingSource=fs.readFileSync('app/(main)/battle/triad-dominion/BattleTiming.ts','utf8');
const timingContext=vm.createContext({exports:{}});
vm.runInContext(ts.transpileModule(timingSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,timingContext);
for(const reduced of [true,false]){
  assert.equal(timingContext.exports.battleStepDuration('strike',reduced),3200);
  assert.equal(timingContext.exports.battleStepDuration('result',reduced),4000);
  assert.equal(timingContext.exports.battleStepDuration('skill',reduced,30),3500);
  assert.equal(timingContext.exports.battleStepDuration('skill',reduced,200),7000);
}
const a={cardNo:'A',kind:'monster'},b={cardNo:'B',kind:'monster'};
context.triadSkillRuleByNo.set('018',{target:'own-main',allowedTurns:[2,3],effects:[{delta:2000}]});
context.triadSkillRuleByNo.set('249',{target:'all',allowedTurns:[2,3],effects:[{delta:-3000}]});
context.triadSkillRuleByNo.set('inactive',{target:'own-main',allowedTurns:[3],effects:[{delta:2000}]});
for(const turn of [2,3]){
  const result={turn,metric:'attack',playerTotal:7000,opponentTotal:6000,prioritySide:'player',winner:'player',skillEvents:[{side:'player',cardNo:'018',summary:'buff',type:'stat'},{side:'opponent',cardNo:'249',summary:'debuff',type:'stat'}]};
  const steps=context.buildBattleSteps(result,{cardNo:'018',kind:'skill'},{cardNo:'249',kind:'skill'},a,b);
  const strike=steps.findIndex(s=>s.kind==='strike');
  assert.equal(steps[strike].cardNo,'A');
  assert.equal(context.battleEmpowermentAtStep(steps,strike,'player').cardNo,'018');
  assert.equal(context.battleEmpowermentAtStep(steps,strike,'opponent'),undefined,'Debuff is not an empowerment');
  assert.equal(context.battleEmpowermentAtStep(steps,1,'player'),undefined,'Power transfers before it carries into strikes');
}
const blockedSteps=context.buildBattleSteps({turn:2,playerTotal:1,opponentTotal:1,skillEvents:[{side:'player',cardNo:'inactive',summary:'inactive',type:'stat'}]},a,b);
assert.equal(context.battleEmpowermentAtStep(blockedSteps,2,'player'),undefined,'Inactive skills cannot power a monster');
for(const priority of ['player','opponent']){
  const result={turn:1,metric:'total',playerTotal:10000,opponentTotal:12000,winner:'opponent',prioritySide:priority,skillEvents:[]};
  const steps=context.buildBattleSteps(result,a,b);
  const strike=steps.map((s,i)=>s.kind==='strike'?i:-1).filter(i=>i>=0);
  assert.deepEqual(JSON.parse(JSON.stringify(context.battleHpAtStep(result,steps,0,false))),{player:10000,opponent:12000});
  const afterFirst=context.battleHpAtStep(result,steps,strike[0],true);
  assert.equal(afterFirst.player,priority==='player'?10000:-2000);
  assert.equal(afterFirst.opponent,priority==='player'?2000:12000);
  assert.equal(steps[strike[1]].value,priority==='player'?12000:10000,'Counterattack uses original power even after lethal damage');
  const last=context.battleHpAtStep(result,steps,steps.length-1,false);
  assert.equal(last.player,-2000);assert.equal(last.opponent,2000);
  assert.equal(context.battleHpAtStep(result,steps,strike[0],false).player,10000,'No damage before contact');
}
for(const power of [0,5000]){
  const result={turn:2,metric:'attack',playerTotal:power,opponentTotal:power,prioritySide:'player',winner:'draw',skillEvents:[]};
  const steps=context.buildBattleSteps(result,{cardNo:'s1',kind:'skill'},{cardNo:'s2',kind:'skill'},a,b);
  assert.equal(steps.filter(s=>s.kind==='strike').length,2);
  assert.equal(steps.find(s=>s.kind==='strike').cardNo,'A');
  const last=context.battleHpAtStep(result,steps,steps.length-1,false);
  assert.equal(last.player,0);assert.equal(last.opponent,0);
}
const clientSource=fs.readFileSync('app/(main)/battle/triad-dominion/TriadDominionClient.tsx','utf8');
const clientAst=ts.createSourceFile('client.tsx',clientSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let advanceEffect;
function visit(n){
  if(ts.isCallExpression(n)&&n.expression.getText(clientAst)==='useEffect'&&n.arguments[0]?.getText(clientAst).includes('const advanceKey =')&&n.arguments[0].getText(clientAst).includes('openerTieBreakAdvanceKeyRef')) advanceEffect=n.arguments[0].getText(clientAst);
  ts.forEachChild(n,visit);
}
visit(clientAst);assert.ok(advanceEffect);
let scheduled=null;
context.window={setTimeout:fn=>{scheduled=fn;return 1;},clearTimeout:()=>{scheduled=null;}};
context.currentRoom={code:'test',game:{activeTurn:1,fightNo:1,turns:[{turn:1,winner:'draw'}],openerTieBreak:{status:'resolved',winner:'host'}}};
context.roomPlayerSide='host';context.cinematicActive=true;
context.openerTieBreakAdvanceKeyRef={current:''};context.openerTieBreakAdvanceTimerRef={current:null};
context.postRoomAction=()=>{};
vm.runInContext(ts.transpileModule(`const advanceEffect=${advanceEffect};`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
vm.runInContext('advanceEffect()',context);assert.equal(scheduled,null,'RPS must not advance during the cinematic');
context.cinematicActive=false;vm.runInContext('advanceEffect()',context);assert.equal(typeof scheduled,'function');
context.cinematicActive=true;vm.runInContext('advanceEffect()',context);assert.equal(scheduled,null);
console.log('HP: 10000 vs 12000, both orders, fixed-power lethal counterattack, contact timing, zero/tie, main monsters and RPS cinematic gate passed');
