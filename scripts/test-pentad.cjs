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
// Reserve and hand copies are distinct physical cards.
room=roomStart();room.phase='select';room.decks.host={monsters:['099'],hand:['005'],reserve:[]};room.decks.challenger={monsters:['177'],hand:['004'],reserve:['004']};room.deadline=now+100;
action(room,host,'pick',{cardNo:'099'});action(room,rival,'pick',{cardNo:'177'});tick(room);assert.equal(room.boost.challenger,'004');assert.equal(room.decks.challenger.reserve.length,0);assert.deepEqual(store.pentadAvailable(room,'challenger','skill'),['004']);assert.equal(room.rounds.at(-1).totals.challenger,triad.triadCardByNo.get('177').attack+triad.triadCardByNo.get('177').support+3000);
const baseline=rules.resolvePentadTurn({fight:1,turn:1,mains:{host:'099',challenger:'177'},skills:{host:'',challenger:'254'},opener:'host'});
assert.equal(baseline.events.length,0,'Non-stat boost skills never activate on turn one');
for(const no of triad.triadCards.filter(card=>card.kind==='skill'&&card.cardNo!=='265').map(card=>card.cardNo))for(const turn of [2,3,4,5]) {
  const mapped=turn<4?2:3, lane=mapped===2?'left':'right';
  const pentad=rules.resolvePentadTurn({fight:1,turn,mains:{host:'021',challenger:'099'},skills:{host:no,challenger:''},opener:'host',targets:{host:'player-top',challenger:''}});
  const original=triad.resolveTriadTurn({turn:mapped,player:{top:'021',[lane]:no},opponent:{top:'099'},prioritySide:'player',skillTargets:{player:{[no]:'player-top'}}});
  assert.equal(pentad.totals.host,original.playerTotal,'Shared skill '+no+' turn '+turn);assert.equal(pentad.totals.challenger,original.opponentTotal);
}
console.log('Pentad: 150 deck completions, all elemental relations, 40 complete games, privacy, stale actions, scores and tie replacement passed');
