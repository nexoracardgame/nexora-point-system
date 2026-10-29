const assert = require('node:assert/strict');
const load = require('./game-collection-test-loader.cjs')();
const { triadCards, triadSkillRuleByNo, resolveTriadTurn } = load('lib/triad-dominion.ts');
const { resolvePentadTurn } = load('lib/pentad-dominion.ts');
const { resolveHeptadClash } = load('lib/heptad-resolution.ts');
const monsters = triadCards.filter(c => c.kind === 'monster');
assert.deepEqual(triadSkillRuleByNo.get('240').elementCondition, { mode: 'exclude', elements: ['gold'] });
for (const card of monsters) {
  for (const [no, turn, metric, delta, immune] of [
    ['240', 2, 'attack', 2000, 'gold'], ['240', 3, 'support', 3000, 'gold'],
    ['274', 3, 'support', 3000, 'fire'],
  ]) {
    const loss = card.element === immune ? 0 : delta;
    const lane = turn === 2 ? 'left' : 'right';
    const r = resolveTriadTurn({ turn, player: { top: card.cardNo, [lane]: no }, opponent: { top: card.cardNo }, skillTargets: { player: { [no]: 'bot-top' } } });
    assert.equal(r.opponentTotal, card[metric] - loss, `TRIAD ${no}/${card.cardNo} enemy`);
    assert.equal(r.playerTotal, card[metric] - (no === '274' ? loss : 0));
    const p = resolvePentadTurn({ fight: 1, turn: turn === 2 ? 3 : 4, mains: { host: card.cardNo, challenger: card.cardNo }, skills: { host: no, challenger: '' }, opener: 'host', targets: { host: 'bot-top', challenger: '' } });
    assert.equal(p.totals.challenger, card[metric] - loss, `PENTAD ${no}/${card.cardNo}`);
    for (const target of ['bot-top', 'bot-secondary']) {
      const h = resolveHeptadClash({ board: { host: { 1: card.cardNo, 2: card.cardNo, 5: card.cardNo }, challenger: { 1: card.cardNo, 2: card.cardNo, 5: card.cardNo } }, turn: turn === 2 ? 3 : 6, opener: 'host', casts: [{ side: 'host', cardNo: no, target, kind: 'normal' }], seed: 'regression' });
      assert.equal(h.totals.challenger, card[metric] * 2 - loss * (no === '274' ? 2 : 1), `HEPTAD ${no}/${card.cardNo}/${target}`);
      assert.equal(h.totals.host, card[metric] * 2 - (no === '274' ? loss * 2 : 0));
    }
  }
}
console.log(`240/274: ${monsters.length} monsters, all elements, TRIAD/PENTAD/HEPTAD and secondary targets passed`);
