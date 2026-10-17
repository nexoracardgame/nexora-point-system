const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
// Reuse the real desktop controls and mocked native bridge from the controls fixture.
const fixture=fs.readFileSync('scripts/test-game-controls-ui.cjs','utf8');
const bundle=new Function('require',fixture.slice(0,fixture.indexOf('(async()=>'))+'return bundle;')(require);
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
for(const [width,height]of [[3840,2160],[1920,1080],[1366,768],[1024,768],[800,450]]){
 const page=await browser.newPage({viewport:{width,height}});
 const css=fs.readFileSync('components/BattleHud.css','utf8')+fs.readFileSync('components/GameWindowControls.css','utf8');
 for(const kind of ['arena','deck']){
 await page.goto('about:blank');
 await page.setContent(`<style>body{margin:0;background:#15282d}*{box-sizing:border-box}${css}</style><header class="nexora-${kind}-header"><img width="100" src="/images/triad/nexora-official-logo.webp"><div class="nexora-arena-brand"><small>BATTLE ROOM</small><strong>Pentad Dominion / Triad Dominion</strong></div><div class="nexora-${kind}-header-actions"><span>◷ 1:59</span><button aria-label="ยอมแพ้">⚑</button><button aria-label="ออกจากห้อง">➜</button></div></header><div id="root"></div>`);
 await page.addScriptTag({content:bundle});await page.locator('.nexora-window-controls').waitFor();
 for(const mode of ['windowed','fullscreen']){
 await page.evaluate(mode=>{document.documentElement.dataset.gameWindowMode=mode;window.dispatchEvent(new Event('nexora:window-mode'))},mode);
 await page.waitForTimeout(80);
 const controls=await page.locator('.nexora-window-controls').boundingBox(),actions=await page.locator(`.nexora-${kind}-header-actions`).boundingBox();
 assert.ok(actions.x>=0&&actions.y>=0,'Actions fit');assert.ok(actions.x+actions.width<=controls.x-8,'Actions stay left of native toolbar');assert.ok(Math.abs(actions.y-controls.y)<1,'Top edges align');assert.ok(Math.abs(actions.height-controls.height)<2,'Toolbar heights align');
 assert.equal(await page.locator('[aria-label="ปิดเกม"]').count(),1);
 }
 await page.evaluate(()=>{const intro=document.createElement('div');intro.className='nexora-versus-plane';document.body.append(intro)});
 assert.equal(await page.locator(`.nexora-${kind}-header-actions`).isVisible(),false,'Battle actions stay hidden during VS');
 await page.locator('.nexora-versus-plane').evaluate(el=>el.remove());
 }
 fs.mkdirSync('artifacts/pc-battle-header',{recursive:true});await page.screenshot({path:`artifacts/pc-battle-header/${width}.png`});await page.close();console.log(`PC arena/deck toolbar alignment ${width}x${height}: windowed/fullscreen passed`);
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
