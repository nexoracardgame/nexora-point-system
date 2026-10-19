const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const origin = process.env.GAME_TEST_ORIGIN || 'http://localhost:3015';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const mode of ['browser', 'desktop', 'legacy', 'generic-desktop']) {
      const game = mode === 'desktop' || mode === 'legacy';
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 },
        ...(mode === 'legacy' ? { userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 nexora-card-game/1.0.6 Electron/38.0.0 Safari/537.36' } : {}),
      });
      if (mode !== 'browser') await context.addInitScript(({ mode }) => {
        window.nexoraDesktop = { isDesktop: true, isGameDesktop: mode === 'desktop',
          windowControl: async () => true, getVersion: async () => '1.0.12',
          onUpdate: () => () => {}, checkForUpdates: async () => {}, installUpdate: async () => {},
        };
      }, { mode });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/auth/session', route => route.fulfill({ json: {} }));
      await page.goto(`${origin}/game`);
      if (game) {
        await page.waitForURL('**/game/login?**');
        await page.locator('[data-game-platform] input[name="username"]').waitFor();
        assert.equal(await page.locator('.nexora-web-login').count(), 0);
        assert.equal(await page.locator('[data-game-platform]').count(), 1);
      } else {
        await page.waitForFunction(() => document.body.innerText.includes('NEXORA'));
        assert.equal(new URL(page.url()).pathname, '/game');
        assert.equal(await page.locator('[data-game-platform]').count(), 0);
      }
      assert.deepEqual(errors, []);
      console.log(`${mode}: ${game ? 'installed launcher login' : 'website'} passed`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
