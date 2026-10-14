const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const cache = {};
function load(file) {
  if (cache[file]) return cache[file].exports;
  const module = cache[file] = { exports: {} };
  const requireLocal = id => {
    if (id === '@/public/cards/card-skill-db.json') return require('../public/cards/card-skill-db.json');
    if (id === './prisma') return { prisma: {} };
    if (id.startsWith('./')) return load('lib/' + id.slice(2) + '.ts');
    return require(id);
  };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(requireLocal, module, module.exports);
  return module.exports;
}
const rules = load('lib/pentad-dominion.ts');
const store = load('lib/pentad-room-store.ts');
const triad = load('lib/triad-dominion.ts');
const host = { id: 'a', name: 'A', image: '/avatar.png' };
const rival = { id: 'b', name: 'B', image: '/avatar.png' };
const sides = ['host', 'challenger'];
let now = 1_000_000;
const action = (room, actor, action, extra = {}) => store.applyPentadAction(room, actor, { action, epoch: room.epoch, ...extra }, now);
const tick = room => store.tickPentadRoom(room, now);
function roomStart() { const room = store.newPentadRoom('123456', host, now); action(room, rival, 'join'); action(room, host, 'start'); return room; }
for (let i = 0; i < 150; i++) {
  const deck = rules.completePentadDeck(rules.emptyPentadDeck());
  assert.deepEqual(rules.validatePentadDeck(deck), []);
  assert.equal(deck.monsters.length, 5); assert.equal(deck.hand.length, 15); assert.equal(deck.reserve.length, 10);
  for (const e of rules.pentadElements) assert.equal([...deck.monsters, ...deck.hand, ...deck.reserve].filter(no => triad.triadCardByNo.get(no).element === e).length, 6);
  const partial = { monsters: deck.monsters.slice(0, 2), hand: deck.hand.slice(0, 7), reserve: deck.reserve.slice(0, 4) };
  const completed = rules.completePentadDeck(partial);
  assert.deepEqual(rules.validatePentadDeck(completed), []);
  for (const key of ['monsters', 'hand', 'reserve']) assert.deepEqual(completed[key].slice(0, partial[key].length), partial[key]);
}
assert.equal(rules.validatePentadDeck({ monsters: ['021', '021'], hand: [], reserve: [] }, true).length > 0, true);
for (const [a, b] of [['wood','earth'], ['earth','water'], ['water','fire'], ['fire','gold'], ['gold','wood']]) {
  assert.equal(rules.pentadElementRelation(a,b).winner, 'host');
  assert.equal(rules.pentadElementRelation(b,a).winner, 'challenger');
}
for (const [a,b] of [['water','wood'],['wood','fire'],['fire','earth'],['earth','gold'],['gold','water']]) {
  assert.equal(rules.pentadElementRelation(a,b).boosted, 'challenger');
  assert.equal(rules.pentadElementRelation(b,a).boosted, 'host');
}
assert.equal(rules.comparePentadPower({host:6000,challenger:5000},{host:4000,challenger:5000}), 'host');
assert.equal(rules.comparePentadPower({host:5000,challenger:5000},{host:5000,challenger:5000}), 'draw');
let room = roomStart();
assert.equal(room.deadline-now,600_000);
now = room.deadline; tick(room);
assert.equal(room.phase,'select');
for (const side of sides) assert.deepEqual(rules.validatePentadDeck(room.decks[side]),[]);
room = roomStart();
for (const [side,actor] of [['host',host],['challenger',rival]]) action(room,actor,'ready',{deck:rules.completePentadDeck(rules.emptyPentadDeck())});
tick(room); assert.equal(room.phase,'select'); assert.equal(room.turn,1);
const staleEpoch = room.epoch-1;
assert.throws(()=>store.applyPentadAction(room,host,{action:'pick',epoch:staleEpoch,cardNo:room.decks.host.monsters[0]},now),/ตาก่อน/);
// Run complete games under the real timeout/target/skill engine, not a mock result.
for(let game=0;game<40;game++) {
  room=roomStart();
  for(const [side,actor] of [['host',host],['challenger',rival]]) action(room,actor,'ready',{deck:rules.completePentadDeck(rules.emptyPentadDeck())});
  tick(room);
  let iterations=0;
  while(room.phase!=='finished' && iterations++<150) { now=Math.max(now,room.deadline)+1;tick(room); }
  assert.equal(room.phase,'finished','No phase can remain stuck');
  assert.ok(iterations<150);
  assert.ok(room.score.host+room.score.challenger<=15);
  for(const side of sides) {
    const counts={};for(const no of room.used[side]) counts[no]=(counts[no]||0)+1;
    for(const [no,count] of Object.entries(counts)) assert.ok(count<=[...room.decks[side].monsters,...room.decks[side].hand].filter(n=>n===no).length,`${side} No.${no} never reuses a card`);
  }
  const score={host:0,challenger:0};for(const result of room.rounds) if(result.winner!=='draw'&&!result.finalDuel) score[result.winner]++;
  assert.deepEqual(room.score,score,'Points reflect individual turns, not fight wins');
}
// Concealed cards and unselected reserve order must never leak to players/viewers.
room=roomStart();room.decks.host=rules.completePentadDeck(rules.emptyPentadDeck());room.decks.challenger=rules.completePentadDeck(rules.emptyPentadDeck());
room.phase='select';room.picks.challenger=room.decks.challenger.monsters[0];
const publicRoom=store.publicPentadRoom(room,host.id);
assert.equal(publicRoom.picks.challenger,'hidden');assert.equal(publicRoom.decks.challenger.hand.length,0);assert.ok(publicRoom.decks.challenger.reserve.every(no=>no===''));
assert.throws(()=>action(room,{id:'intruder',name:'X'},'pick',{cardNo:'021'}),/เข้าร่วมห้อง/);
// A tied monster is discarded on both sides, without RPS or a free point.
room=roomStart();room.phase='select';room.deadline=now+100;room.decks.host={monsters:['021','022'],hand:[],reserve:[]};room.decks.challenger={monsters:['021','023'],hand:[],reserve:[]};
action(room,host,'pick',{cardNo:'021'});action(room,rival,'pick',{cardNo:'021'});tick(room);
assert.equal(room.phase,'result');assert.equal(room.rounds.at(-1).winner,'draw');assert.deepEqual(room.score,{host:0,challenger:0});now=room.deadline+1;tick(room);assert.equal(room.phase,'select');assert.equal(room.turn,1);assert.ok(!store.pentadAvailable(room,'host','monster').includes('021'));
// Reserve draw consumes its card without consuming a different hand skill.
room=roomStart();room.phase='select';room.decks.host={monsters:['099'],hand:['005'],reserve:[]};room.decks.challenger={monsters:['177'],hand:['005'],reserve:['004']};room.deadline=now+100;
action(room,host,'pick',{cardNo:'099'});action(room,rival,'pick',{cardNo:'177'});tick(room);assert.equal(room.boost.challenger,'004');assert.equal(room.decks.challenger.reserve.length,0);assert.deepEqual(store.pentadAvailable(room,'challenger','skill'),['005']);assert.equal(room.rounds.at(-1).totals.challenger,triad.triadCardByNo.get('177').attack+triad.triadCardByNo.get('177').support+3000);
const baseline=rules.resolvePentadTurn({fight:1,turn:1,mains:{host:'099',challenger:'177'},skills:{host:'',challenger:'254'},opener:'host'});
assert.equal(baseline.events.length,0,'Non-stat boost skills never activate on turn one');
for(const no of triad.triadCards.filter(card=>card.kind==='skill'&&card.cardNo!=='265').map(card=>card.cardNo))for(const turn of [2,3,4,5]) {
  const mapped=turn<4?2:3, lane=mapped===2?'left':'right';
  const pentad=rules.resolvePentadTurn({fight:1,turn,mains:{host:'021',challenger:'099'},skills:{host:no,challenger:''},opener:'host',targets:{host:'player-top',challenger:''}});
  const original=triad.resolveTriadTurn({turn:mapped,player:{top:'021',[lane]:no},opponent:{top:'099'},prioritySide:'player',skillTargets:{player:{[no]:'player-top'}}});
  assert.equal(pentad.totals.host,original.playerTotal,'Shared skill '+no+' turn '+turn);assert.equal(pentad.totals.challenger,original.opponentTotal);
}
console.log('Pentad: 150 deck completions, all elemental relations, 40 complete games, privacy, stale actions, scores and tie replacement passed');
// No.245 must offer every opposing skill on this fight's board, not a monster target.
room=roomStart();room.phase='select';room.turn=3;room.board={host:['021','001'],challenger:['099','005']};room.decks.host={monsters:['021'],hand:['245'],reserve:[]};room.decks.challenger={monsters:['099'],hand:['004'],reserve:[]};room.picks={host:'',challenger:''};room.opener='host';room.deadline=now+120000;
action(room,host,'pick',{cardNo:'245'});action(room,rival,'pick',{cardNo:'004'});tick(room);
assert.equal(room.phase,'target');const copyChoice=room.choices.find(choice=>choice.kind==='copy');assert.deepEqual(copyChoice.options,['skill:1:005','skill:2:004']);
assert.throws(()=>action(room,host,'target',{target:'skill:1:001'}),/เป้าหมาย/);
action(room,host,'target',{target:'skill:2:004'});tick(room);assert.equal(room.phase,'result');assert.equal(room.copiedSkills.host,'004');
assert.ok(room.rounds.at(-1).events.some(event=>event.cardNo==='245'&&event.summary.includes('004')));
const explicit=rules.resolvePentadTurn({fight:1,turn:3,mains:{host:'177',challenger:'099'},skills:{host:'245',challenger:'002'},opener:'host',copiedSkills:{host:'004',challenger:''}});
assert.equal(explicit.totals.host,triad.triadCardByNo.get('177').attack+3000,'Copying an older skill uses that skill, not the current opponent skill');
// A copied targeting skill asks for its own legal target after the copy choice.
room=roomStart();room.phase='select';room.turn=3;room.board={host:['021','001'],challenger:['099','225']};room.decks.host={monsters:['021'],hand:['245'],reserve:[]};room.decks.challenger={monsters:['099'],hand:['004'],reserve:[]};room.deadline=now+120000;
action(room,host,'pick',{cardNo:'245'});action(room,rival,'pick',{cardNo:'004'});tick(room);action(room,host,'target',{target:'skill:1:225'});tick(room);
assert.equal(room.phase,'target');assert.equal(room.choices.find(choice=>!choice.value).sourceCardNo,'225');
const target=room.choices.find(choice=>!choice.value).options[0];action(room,host,'target',{target});tick(room);assert.equal(room.phase,'result');
room.decks.host.hand.push('003');room.decks.challenger.hand.push('005');
const last=room.rounds.at(-1);action(room,host,'complete',{roundId:last.id});tick(room);assert.equal(room.phase,'result','One PVP player completing does not cut off their opponent');action(room,rival,'complete',{roundId:last.id});tick(room);assert.equal(room.phase,'select');assert.equal(room.turn,4);assert.equal(room.board.challenger[0],'099','Opponent main remains visible in the next turn');
console.log('Pentad No.245: all field skills, invalid choices, historical copy, follow-up target, scene completion and persistent main cards passed');
const flash=rules.resolvePentadTurn({fight:3,turn:4,mains:{host:'177',challenger:'099'},skills:{host:'245',challenger:''},opener:'host',copiedSkills:{host:'265',challenger:''},spent:['021','022']});
assert.notEqual(flash.effective.challenger,'099');assert.ok(!['021','022'].includes(flash.effective.challenger));assert.equal(flash.support.challenger,triad.triadCardByNo.get(flash.effective.challenger).support,'Copying No.265 applies the replacement SUPPORT on turn four');assert.equal(flash.totals.challenger,flash.support.challenger,'Fight three turn four is SUPPORT, never combined');
const low=triad.triadCards.find(card=>card.kind==='monster'&&card.attack<=3000&&card.support>0);
const high=triad.triadCards.find(card=>card.kind==='monster'&&card.attack>7000);
const invalid=triad.triadCards.find(card=>card.kind==='monster'&&card.attack>3000);
for(const owner of ['player','opponent']) {
  const target=owner==='player'?'bot-top':'player-top';
  const result=triad.resolveTriadTurn({turn:3,player:{top:low.cardNo,...(owner==='player'?{right:'226'}:{})},opponent:{top:low.cardNo,...(owner==='opponent'?{right:'226'}:{})},prioritySide:owner,skillTargets:{[owner]:{'226':target}}});
  assert.equal(owner==='player'?result.opponentTotal:result.playerTotal,0,'226 zeros eligible SUPPORT from either side');
}
const fail226=triad.resolveTriadTurn({turn:3,player:{top:low.cardNo,right:'226'},opponent:{top:invalid.cardNo},skillTargets:{player:{'226':'bot-top'}}});
assert.equal(fail226.opponentTotal,invalid.support,'226 does not activate above 3000 ATK');
const zero227=triad.resolveTriadTurn({turn:2,player:{top:high.cardNo,left:'004'},opponent:{top:low.cardNo,left:'227'},prioritySide:'player',skillTargets:{opponent:{'227':'player-top'}}});
assert.equal(zero227.playerTotal,0,'227 removes the buffed contribution, not only printed ATK');
for(const metric of ['attack','support']) {
  const otherMetric=metric==='attack'?'support':'attack',turn=metric==='attack'?2:3,lane=metric==='attack'?'left':'right';
  const eligible=triad.triadCards.filter(card=>card.kind==='monster'&&card[metric]>7000&&card[metric]>=card[otherMetric]).sort((a,b)=>a[metric]-b[metric]);
  const selected=eligible[0],stronger=eligible.at(-1);
  assert.ok(selected&&stronger&&stronger[metric]>selected[metric],'227 fixture covers a lower-stat selected monster');
  const result=triad.resolveTriadTurn({turn,player:{top:selected.cardNo},opponent:{top:stronger.cardNo,[lane]:'227'},skillTargets:{opponent:{'227':'player-top'}}});
  assert.equal(result.playerTotal,0,'227 uses the selected monster highest stat, not the highest field stat');
  assert.equal(result.opponentTotal,stronger[metric],'227 does not zero the unselected stronger monster');
}
room=store.newPentadRoom('333333',host,now);room.deckSource='random';action(room,rival,'join');action(room,host,'start');
assert.deepEqual(room.decks.host,room.decks.challenger,'Random mode starts with empty selectable decks for both players');
for(const group of ['monsters','hand','reserve'])assert.equal(room.pools[group].length,30,'Random mode offers thirty options per group');
assert.equal(new Set([...room.pools.monsters,...room.pools.hand,...room.pools.reserve]).size,90);
const poolDeck=rules.completePentadDeck(rules.emptyPentadDeck(),Math.random,room.pools);assert.equal(new Set([...poolDeck.monsters,...poolDeck.hand,...poolDeck.reserve]).size,30);action(room,host,'deck',{deck:poolDeck});
assert.ok(rules.validatePentadDeck({...poolDeck,hand:[poolDeck.hand[0],poolDeck.hand[0]]},true).length>0,'Only one copy per skill is permitted');
room=roomStart();room.phase='target';room.board={host:[low.cardNo],challenger:[invalid.cardNo]};room.turn=4;room.picks={host:'226',challenger:'004'};room.choices=[{side:'host',cardNo:'226',options:['player-top'],value:'',deadline:now+30000}];
const identity={action:'target',epoch:room.epoch,choiceIndex:0,cardNo:'226',sourceCardNo:'',target:'player-top'};
store.applyPentadAction(room,host,identity,now);store.applyPentadAction(room,host,identity,now);tick(room);store.applyPentadAction(room,host,identity,now);
assert.equal(room.rounds.length,1,'Duplicate confirmation cannot resolve twice or bounce after result');
assert.ok(rules.resolvePentadTurn({fight:1,turn:1,mains:{host:'099',challenger:'177'},skills:{host:'',challenger:'254'},opener:'host'}).stages.some(stage=>stage.detail.includes('ไม่ใช่การเพิ่ม')),'Boost explanation says why non-stat skill is ignored');
console.log('226/227 conditions, chosen-monster stat zero, equal random pools, idempotent target and elemental trace passed');
const clientSource=fs.readFileSync('app/(main)/battle/triad-dominion/TriadDominionClient.tsx','utf8');
const clientAst=ts.createSourceFile('client.tsx',clientSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const targetFunction=clientAst.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='getPlayableSkillTargetIds');
const ui=vm.createContext({getSelectableSkillTargetIds:()=>['player-top','bot-top'],triadSkillRuleByNo:triad.triadSkillRuleByNo});
vm.runInContext(ts.transpileModule(targetFunction.getText(clientAst),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ui);
const a={kind:'monster',attack:8000,support:1000},b={kind:'monster',attack:7000,support:9000};
assert.equal(ui.getPlayableSkillTargetIds({cardNo:'227'},'player',a,b,2).join(','),'player-top,bot-top');
assert.equal(ui.getPlayableSkillTargetIds({cardNo:'227'},'player',a,b,3).join(','),'player-top,bot-top');
assert.equal(ui.getPlayableSkillTargetIds({cardNo:'227'},'player',a,b,1).join(','),'player-top,bot-top');
assert.equal(ui.getPlayableSkillTargetIds({cardNo:'226'},'player',{...a,attack:3000},b,3).join(','),'player-top');
console.log('Legacy target UI: exact 3000 boundary and selected-monster ATK/SUP filters passed');
for(const fight of [1,2,3])for(const turn of [2,3,4,5]) {
  const result=rules.resolvePentadTurn({fight,turn,mains:{host:'021',challenger:'099'},skills:{host:'',challenger:''},opener:'host'});
  const metric=turn<4?'attack':'support';
  assert.equal(result.totals.host,triad.triadCardByNo.get('021')[metric]);assert.equal(result.totals.challenger,triad.triadCardByNo.get('099')[metric]);
}
console.log('All three fights: turns 2/3 ATTACK and turns 4/5 SUPPORT passed');
const water=triad.triadCards.find(card=>card.kind==='monster'&&card.element==='water'&&card.attack>0),earth=triad.triadCards.find(card=>card.kind==='monster'&&card.element==='earth'),nonEarth=triad.triadCards.find(card=>card.kind==='monster'&&card.element!=='earth');
for(const owner of ['player','opponent'])for(const priority of ['player','opponent']) {
  const user=owner==='player'?{top:earth.cardNo,left:'255'}:{top:earth.cardNo,left:'255'};
  const target={top:water.cardNo,left:'004'};
  const result=triad.resolveTriadTurn({turn:2,player:owner==='player'?user:target,opponent:owner==='player'?target:user,prioritySide:priority});
  assert.equal(owner==='player'?result.opponentTotal:result.playerTotal,0,'255 blocks opposing WATER ATTACK even if buffed');
  assert.equal(owner==='player'?result.playerTotal:result.opponentTotal,earth.attack,'255 never buffs its user');
}
const wrong255=triad.resolveTriadTurn({turn:2,player:{top:water.cardNo,left:'255'},opponent:{top:earth.cardNo}});assert.equal(wrong255.opponentTotal,earth.attack);assert.equal(wrong255.playerTotal,water.attack);
for(const turn of [2,3])for(const owner of ['player','opponent']) {
  const lane=turn===2?'left':'right',skill={top:earth.cardNo,[lane]:'229'},target={top:nonEarth.cardNo};
  const result=triad.resolveTriadTurn({turn,player:owner==='player'?skill:target,opponent:owner==='player'?target:skill,skillTargets:{[owner]:{'229':owner==='player'?'bot-top':'player-top'}}});
  assert.equal(owner==='player'?result.opponentTotal:result.playerTotal,nonEarth[turn===2?'attack':'support']-(turn===2?2000:3000),'229 debuffs exactly the chosen non-earth monster');
}
for(const turn of [2,3,4,5])for(const owner of sides) {
  const result=rules.resolvePentadTurn({fight:1,turn,mains:{host:water.cardNo,challenger:earth.cardNo},skills:{host:owner==='host'?'265':'',challenger:owner==='challenger'?'265':''},opener:owner});
  const target=owner==='host'?'challenger':'host';assert.notEqual(result.effective[target],target==='host'?water.cardNo:earth.cardNo);assert.equal(result.totals[target],triad.triadCardByNo.get(result.effective[target])[turn<4?'attack':'support']);
}
room=roomStart();room.phase='select';room.turn=2;room.board={host:[water.cardNo],challenger:[earth.cardNo]};room.decks.host={monsters:[],hand:['265','004'],reserve:[]};room.decks.challenger={monsters:[],hand:['004','005'],reserve:[]};room.deadline=now+120000;action(room,host,'pick',{cardNo:'265'});action(room,rival,'pick',{cardNo:'004'});tick(room);const replaced=room.board.challenger[0];assert.notEqual(replaced,earth.cardNo);assert.equal(replaced,room.rounds.at(-1).effective.challenger);assert.equal(room.rounds.at(-1).scoreAfter.host-room.rounds.at(-1).scoreBefore.host,room.rounds.at(-1).winner==='host'?1:0);now=room.deadline+1;tick(room);assert.equal(room.board.challenger[0],replaced,'265 replacement remains after the animation');
room.phase='select';room.turn=1;room.board.challenger[0]='099';room.picks.challenger='099';const hidden=store.publicPentadRoom(room,host.id);assert.equal(hidden.board.challenger[0],'');assert.equal(hidden.picks.challenger,'hidden');
console.log('255 water attack lock, 229 chosen non-earth target, 265 replacement/persistence, score snapshots and concealed first turn passed');
const self229=triad.resolveTriadTurn({turn:2,player:{top:nonEarth.cardNo,left:'229'},opponent:{top:earth.cardNo},skillTargets:{player:{'229':'player-top'}}});assert.equal(self229.playerTotal,nonEarth.attack-2000);assert.equal(self229.opponentTotal,earth.attack,'229 obeys selecting own non-earth monster too');
const safeEarth=triad.resolveTriadTurn({turn:2,player:{top:nonEarth.cardNo,left:'229'},opponent:{top:earth.cardNo},skillTargets:{player:{'229':'bot-top'}}});assert.equal(safeEarth.opponentTotal,earth.attack);
for(let i=0;i<100;i++){const pools=rules.makePentadPools();const full=rules.completePentadDeck(rules.emptyPentadDeck(),Math.random,pools);const partial={monsters:full.monsters.slice(0,2),hand:full.hand.slice(0,8),reserve:full.reserve.slice(0,4)};const filled=rules.completePentadDeck(partial,Math.random,pools);assert.deepEqual(rules.validatePentadDeck(filled),[]);for(const group of ['monsters','hand','reserve'])assert.deepEqual(filled[group].slice(0,partial[group].length),partial[group]);}
console.log('229 own/opposing target and 100 unique random-pool deck completions passed');
const crypto=require('node:crypto');
const privateRoom=store.newPentadRoom('444444',host);privateRoom.access='private';privateRoom.passwordHash='qa:'+crypto.scryptSync('nexora','qa',32).toString('hex');
assert.throws(()=>store.applyPentadAction(privateRoom,rival,{action:'join',password:'wrong'}),/รหัสผ่าน/);
store.applyPentadAction(privateRoom,rival,{action:'join',password:'nexora'});assert.equal(privateRoom.seats.challenger.id,rival.id);
assert.equal(store.publicPentadRoom(privateRoom,rival.id).passwordHash,undefined,'Password hash never crosses the API boundary');
console.log('Pentad private-room password validation and secret redaction passed');
