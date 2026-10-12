const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('lib/triad-room-store.ts', 'utf8');
const ast = ts.createSourceFile('store.ts', source, ts.ScriptTarget.Latest, true);
const names = new Set([
  'emptyTriangle', 'emptyOpeningTieBreak', 'normalizeDeck', 'normalizeDeckForMode',
  'deckCardCounts', 'validateDeckForMode', 'shuffled', 'autoCompleteDeckForMode',
  'battleDecksReady', 'finalizeDeckSelection', 'enforceDeckGate', 'withRoomMutationLock',
  'setTriadRoomDeck', 'readyTriadRoomDeck',
  'normalizeRpsChoice', 'rpsWinner', 'settleOpeningTieBreak',
  'chooseTriadRoomOpeningTieBreak', 'resetTriadRoomOpeningTieBreak', 'botChooseOpeningTieBreak',
]);
const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text));
assert.equal(functions.length, names.size);
const cards = [
  ...Array.from({ length: 30 }, (_, i) => ({ cardNo: `m${i}`, kind: 'monster' })),
  ...Array.from({ length: 30 }, (_, i) => ({ cardNo: `s${i}`, kind: 'skill' })),
];
let now = 1_000_000;
let stored;
const context = vm.createContext({
  exports: {}, Date: { now: () => now },
  TRIAD_DECK_SIZE: 20, TRIAD_MONSTER_DECK_SIZE: 20,
  TRIAD_SKILL_MODE_MONSTERS: 10, TRIAD_SKILL_MODE_SKILLS: 10,
  DECK_SELECTION_TIMEOUT_MS: 300_000,
  triadCardByNo: new Map(cards.map(card => [card.cardNo, card])),
  globalForTriadRooms: {}, cleanText: value => String(value || '').trim(),
  warmBotMemory: async () => {}, repairSelectionPools: () => false,
  runBotBrain: () => false, publicRoom: room => structuredClone(room),
  resolveIfBothLocked: () => {}, healTriadRoomState: room => context.settleOpeningTieBreak(room),
  isTriadBotParticipant: participant => participant?.id === 'bot',
  sideForParticipant: (_, id) => id,
  getStoredRoom: async () => { await new Promise(resolve => setTimeout(resolve, 2)); return structuredClone(stored); },
  upsertStoredRoom: async room => { await new Promise(resolve => setTimeout(resolve, 2)); stored = structuredClone(room); },
});
vm.runInContext(ts.transpileModule(functions.map(node => node.getText(ast)).join('\n'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, context);
const call = (name, ...args) => context[name](...args);
const clientSource = fs.readFileSync('app/(main)/battle/triad-dominion/TriadDominionClient.tsx', 'utf8');
const clientAst = ts.createSourceFile('client.tsx', clientSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const clientFunctions = clientAst.statements.filter(node => ts.isFunctionDeclaration(node) &&
  ['roomDecksReadyForBattle', 'roomTurnSecondsLeft'].includes(node.name?.text));
assert.equal(clientFunctions.length, 2);
const clientContext = vm.createContext({ Date: { now: () => now }, DECK_SIZE: 20, TURN_SECONDS: 120 });
vm.runInContext(ts.transpileModule(clientFunctions.map(node => node.getText(clientAst)).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText, clientContext);
const poolFor = mode => cards.filter(card => mode !== 'monster' || card.kind === 'monster').map(card => card.cardNo);
function roomFor(mode, expired = false) {
  const started = now - (expired ? 300_000 : 10_000);
  return {
    code: 'test', status: 'playing', seats: { host: { id: 'host' }, challenger: { id: 'challenger' } },
    game: {
      deckMode: mode, deckStartedAt: started, turnStartedAt: started,
      decks: { host: [], challenger: [] }, deckReady: { host: false, challenger: false },
      selectionPools: { host: poolFor(mode), challenger: poolFor(mode) },
      triangles: { host: call('emptyTriangle'), challenger: call('emptyTriangle') },
      turns: [], activeTurn: 1, fightNo: 1,
    },
  };
}
function assertStarted(room, mode) {
  assert.equal(call('battleDecksReady', room), true);
  assert.ok(room.game.turnStartedAt > room.game.deckStartedAt);
  for (const side of ['host', 'challenger']) {
    assert.equal(call('validateDeckForMode', mode, room.game.decks[side]).ok, true);
    assert.equal(new Set(room.game.decks[side]).size, 20);
  }
}

(async () => {
  for (const mode of ['all', 'monster', 'skill']) {
    for (const partial of [false, true]) {
      const room = roomFor(mode, true);
      if (partial) room.game.decks.host = ['m0', 'm1'];
      // Recover rooms whose old waiting loop incorrectly advanced turnStartedAt.
      room.game.turnStartedAt = now - 100;
      assert.equal(call('enforceDeckGate', room), true);
      assertStarted(room, mode);
      if (partial) assert.ok(room.game.decks.host.includes('m0'));
      const before = JSON.stringify(room);
      assert.equal(call('enforceDeckGate', room), false);
      assert.equal(JSON.stringify(room), before);
    }
    const waiting = roomFor(mode);
    waiting.game.turnStartedAt = now - 102_000;
    assert.equal(clientContext.roomTurnSecondsLeft(waiting), 120);
    call('enforceDeckGate', waiting);
    assert.equal(waiting.game.turnStartedAt, waiting.game.deckStartedAt);
    const readyDeck = call('autoCompleteDeckForMode', mode, [], poolFor(mode), 'ready');
    waiting.game.decks.host = readyDeck;
    waiting.game.deckReady.host = true;
    assert.equal(clientContext.roomTurnSecondsLeft(waiting), 120);
    now += 300_000;
    call('enforceDeckGate', waiting);
    assertStarted(waiting, mode);
    assert.equal(clientContext.roomTurnSecondsLeft(waiting), 120);
    now += 102_000;
    assert.equal(clientContext.roomTurnSecondsLeft(waiting), 18);
    assert.deepEqual(Array.from(waiting.game.decks.host), Array.from(readyDeck));

    stored = roomFor(mode);
    await Promise.all([
      call('readyTriadRoomDeck', 'test', 'host', readyDeck),
      call('readyTriadRoomDeck', 'test', 'challenger', readyDeck),
      call('setTriadRoomDeck', 'test', 'host', ['m0']),
    ]);
    assertStarted(stored, mode);
    assert.deepEqual(Array.from(stored.game.decks.host), Array.from(readyDeck));
    console.log(`${mode}: timeout, partial decks, locked deck, simultaneous ready passed`);
  }
  const choices = ['rock', 'paper', 'scissors'];
  function rpsRoom() {
    const room = roomFor('all');
    room.game.turns = [{ turn: 1, winner: 'draw' }];
    room.game.openerTieBreak = {
      ...call('emptyOpeningTieBreak'), status: 'waiting', reason: 'first_turn_score_draw',
    };
    return room;
  }
  for (const host of choices) {
    for (const challenger of choices) {
      stored = rpsRoom();
      const expected = call('rpsWinner', host, challenger);
      const results = await Promise.all([
        call('chooseTriadRoomOpeningTieBreak', 'test', 'host', host, { fightNo: 1, round: 1 }),
        call('chooseTriadRoomOpeningTieBreak', 'test', 'challenger', challenger, { fightNo: 1, round: 1 }),
      ]);
      assert.ok(results.every(result => result.ok));
      assert.equal(stored.game.turns[0].winner, 'draw');
      if (expected === 'draw') {
        assert.equal(stored.game.activeTurn, 1);
        assert.equal(stored.game.openerTieBreak.round, 2);
        assert.equal(Object.keys(stored.game.openerTieBreak.choices).length, 0);
        const stale = await call('chooseTriadRoomOpeningTieBreak', 'test', 'host', host, { fightNo: 1, round: 1 });
        assert.equal(stale.reason, 'stale_round');
        assert.equal(Object.keys(stored.game.openerTieBreak.choices).length, 0);
        await call('chooseTriadRoomOpeningTieBreak', 'test', 'host', 'rock', { fightNo: 1, round: 2 });
        await call('chooseTriadRoomOpeningTieBreak', 'test', 'challenger', 'scissors', { fightNo: 1, round: 2 });
      } else {
        assert.equal(stored.game.openerTieBreak.winner, expected);
      }
      assert.equal(stored.game.activeTurn, 2);
      assert.equal(stored.game.openerTieBreak.status, 'resolved');
      assert.equal((await call('resetTriadRoomOpeningTieBreak', 'test', 'host')).reason, 'not_available');
      assert.equal(stored.game.activeTurn, 2);
    }
  }
  stored = rpsRoom();
  await call('chooseTriadRoomOpeningTieBreak', 'test', 'host', 'rock', { round: 1 });
  assert.equal((await call('chooseTriadRoomOpeningTieBreak', 'test', 'host', 'rock', { round: 1 })).ok, true);
  assert.equal((await call('chooseTriadRoomOpeningTieBreak', 'test', 'host', 'paper', { round: 1 })).reason, 'choice_locked');
  assert.equal(stored.game.openerTieBreak.choices.host, 'rock');
  await call('resetTriadRoomOpeningTieBreak', 'test', 'host');
  assert.equal(stored.game.openerTieBreak.round, 2);
  assert.equal((await call('resetTriadRoomOpeningTieBreak', 'test', 'host', { round: 1 })).reason, 'stale_round');
  assert.equal(stored.game.openerTieBreak.round, 2);
  assert.equal((await call('chooseTriadRoomOpeningTieBreak', 'test', 'host', 'rock', { round: 1 })).reason, 'stale_round');
  for (const choice of choices) {
    const room = rpsRoom();
    room.seats.challenger.id = 'bot';
    call('botChooseOpeningTieBreak', room);
    room.game.openerTieBreak.choices.host = choice;
    assert.equal(call('settleOpeningTieBreak', room), true);
    assert.ok(room.game.openerTieBreak.status === 'resolved' || room.game.openerTieBreak.round === 2);
  }
  console.log('RPS: all 9 pairs, concurrent choices, draw replay, stale requests, duplicate choices, reset, bot passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
