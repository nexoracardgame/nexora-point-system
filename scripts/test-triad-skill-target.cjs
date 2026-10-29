const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const source = fs.readFileSync('lib/triad-room-store.ts', 'utf8');
const ast = ts.createSourceFile('store.ts', source, ts.ScriptTarget.Latest, true);
const names = new Set(['chooseTriadRoomSkillTarget', 'withRoomMutationLock', 'markExpiredSkillChoices', 'selectedTargetSlot']);
const code = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.has(n.name?.text)).map(n => n.getText(ast)).join('\n');
let stored;
let now = 1000;
const ctx = vm.createContext({
  exports: {}, Date: { now: () => now }, globalForTriadRooms: {},
  cleanText: v => String(v || '').trim(), sideForParticipant: (_, id) => id, laneForTurn: () => 'left',
  getStoredRoom: async () => { await new Promise(r => setTimeout(r, 3)); return structuredClone(stored); },
  upsertStoredRoom: async room => { await new Promise(r => setTimeout(r, 3)); stored = structuredClone(room); },
  publicRoom: room => structuredClone(room), ensureSkillChoices: () => {}, runBotBrain: () => {}, healTriadRoomState: () => {},
  resolveIfBothLocked: room => { if (room.game.skillChoices.every(c => c.selectedTarget || c.skipped)) room.game.turns = [{ turn: 2 }]; },
  legalManualSkillTargetSlots: () => ['host'],
  legalTargetPreview: require('./game-collection-test-loader.cjs')()('lib/battle-target-preview.ts').legalTargetPreview,
});
vm.runInContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, ctx);
const reset = () => { stored = { code: 'test', game: { deckStartedAt: 100, fightNo: 1, activeTurn: 2, turns: [], skillChoices: [{ fightNo: 1, turn: 2, side: 'host', lane: 'left', cardNo: '235', deadlineAt: 31000, selectedTarget: '', skipped: false }] } }; };
const expected = { deckStartedAt: 100, fightNo: 1, turn: 2, cardNo: '235', deadlineAt: 31000 };
const call = (target = 'player-top', identity = expected) => ctx.chooseTriadRoomSkillTarget('test', 'host', target, identity);
(async () => {
  reset();
  assert.equal((await call('player-top',{...expected,preview:true})).ok,true);
  assert.equal(stored.game.skillChoices[0].previewTarget,'player-top');
  assert.equal(stored.game.skillChoices[0].selectedTarget,'','Preview does not confirm');
  assert.equal(stored.game.turns.length,0);
  assert.equal((await call('bot-top',{...expected,preview:true})).ok,false);
  reset();
  const simultaneous = await Promise.all([call(), call('bot-top')]);
  assert.equal(simultaneous[0].ok, true);
  assert.equal(simultaneous[1].ok, false);
  assert.equal(stored.game.skillChoices[0].selectedTarget, 'player-top');
  assert.equal((await call()).ok, true);
  for (const key of Object.keys(expected)) {
    reset();
    const changed = { ...expected, [key]: typeof expected[key] === 'number' ? expected[key] + 1 : '236' };
    assert.equal((await call('player-top', changed)).reason, 'stale_skill_choice');
    assert.equal(stored.game.skillChoices[0].selectedTarget, '');
  }
  reset();
  assert.equal((await call('bot-top')).reason, 'invalid_target');
  assert.equal(stored.game.skillChoices[0].selectedTarget, '');
  now = 31000;
  assert.equal((await call()).reason, 'choice_expired');
  assert.equal(stored.game.skillChoices[0].skipped, true);
  assert.equal(stored.game.turns.length, 1);
  console.log('Skill target: valid confirm, duplicate, concurrent, stale game/turn/card/deadline, invalid target, exact deadline recovery passed');
})().catch(err => { console.error(err); process.exitCode = 1; });
