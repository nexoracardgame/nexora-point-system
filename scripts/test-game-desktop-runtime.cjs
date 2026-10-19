const assert = require('node:assert/strict');
const load = require('./game-collection-test-loader.cjs')();
const { isInstalledGameRuntime } = load('lib/game-desktop-runtime.ts');
const electron = 'Mozilla/5.0 Chrome/140.0.0.0 Electron/38.0.0';
for (const agent of ['nexora-card-game/1.0.6', 'NexoraCardGame/1.0.12', 'NEXORA CARD GAME/1.0.6']) {
  for (const bridge of [undefined, { isDesktop: true }, { isDesktop: true, isGameDesktop: false }]) {
    assert.equal(isInstalledGameRuntime({ navigator: { userAgent: `${electron} ${agent}` }, nexoraDesktop: bridge }), true);
  }
}
for (const agent of ['', electron, `${electron} nexora-tcg/1.0.6`, 'Mozilla/5.0 Chrome/140.0.0.0', 'NexoraCardGame/1.0.12']) {
  assert.equal(isInstalledGameRuntime({ navigator: { userAgent: agent }, nexoraDesktop: { isDesktop: true } }), false);
}
assert.equal(isInstalledGameRuntime({ nexoraDesktop: { isGameDesktop: true } }), true);
console.log('Desktop game routing: legacy/new game products, missing bridge flag, website and generic desktop separation passed');
