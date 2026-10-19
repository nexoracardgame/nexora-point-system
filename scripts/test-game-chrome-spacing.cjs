const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const css = ['BattleHud', 'GameSettings', 'GameWindowControls'].map(name => fs.readFileSync(`components/${name}.css`, 'utf8')).join('\n');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    fs.mkdirSync('artifacts/game-chrome', { recursive: true });
    for (const [width, height] of [[1920,1080],[1280,720],[1024,768],[844,390],[667,375],[568,320]]) {
      for (const mode of ['windowed', 'fullscreen', 'browser']) {
        const page = await browser.newPage({ viewport: { width, height } });
        for (const scene of ['arena','deck']) {
          const native = mode !== 'browser';
          const controlsWidth = mode === 'fullscreen' ? 44 : 120;
          await page.setContent(`<html ${native ? 'data-game-window-controls="desktop"' : ''} style="--game-window-controls-width:${controlsWidth}px"><style>body{margin:0;background:#080d12}*{box-sizing:border-box}${css}</style><header class="nexora-${scene}-header"><div class="nexora-arena-brand"><strong>NEXORA MATCH</strong></div><div class="nexora-${scene}-header-actions"><span>8:44</span><button aria-label="ยอมแพ้">⚑</button><button id="exit" aria-label="ออกจากห้อง" onclick="window.exited=true">↪</button></div></header><button class="nexora-settings-open" aria-label="ตั้งค่า">⚙</button>${native ? `<div class="nexora-window-controls" style="width:${controlsWidth}px;height:40px"><button>×</button></div>` : ''}</html>`);
          const exit = page.locator('#exit'), settings = page.locator('.nexora-settings-open');
          const a = await exit.boundingBox(), b = await settings.boundingBox();
          assert.ok(a.x >= 0 && a.x + a.width <= b.x - 10, `${width} ${mode} ${scene}: exit must leave settings clearance`);
          await exit.click();
          assert.equal(await page.evaluate(() => window.exited), true);
          assert.ok(await exit.evaluate(node => { const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); }), 'Exit remains unobstructed');
          if (scene === 'arena') await page.screenshot({ path: `artifacts/game-chrome/${width}-${mode}.png` });
        }
        await page.close();
        const cinematic=await browser.newPage({viewport:{width,height}});
        await cinematic.setContent(`<style>${css}[data-battle-cinematic-actions]{position:fixed;top:8px;right:12px}button{width:40px;height:40px}</style><button class="nexora-settings-open">Settings</button><div class="nexora-window-controls"><button>Close</button></div><div data-battle-cinematic><div data-battle-cinematic-actions><button id="skip" onclick="window.skipped=true">Skip</button></div></div>`);
        const skip=await cinematic.locator('#skip').boundingBox(),chrome=await cinematic.locator('.nexora-window-controls').boundingBox();assert.ok(skip.y>=chrome.y+chrome.height+6,'Skip is below native window chrome');await cinematic.locator('#skip').click();assert.equal(await cinematic.evaluate(()=>window.skipped),true);await cinematic.close();
      }
      console.log(`${width}x${height}: arena/deck exit clear of settings in native windowed/fullscreen and browser`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
