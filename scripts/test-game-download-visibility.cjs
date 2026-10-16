const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.GAME_TEST_URL||'http://localhost:3013';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const mode of ['web','game-desktop','legacy-desktop','electron-fallback']){
  const page=await browser.newPage({viewport:{width:1920,height:1080},...(mode==='electron-fallback'?{userAgent:'Mozilla/5.0 Electron/41.5.0'}:{})});
  await page.route('**/videos/nexora-login-4k/**',route=>route.abort());
  await page.addInitScript(mode=>{if(mode==='game-desktop')window.nexoraDesktop={isGameDesktop:true,isDesktop:true};if(mode==='legacy-desktop')window.nexoraDesktop={isDesktop:true};window.downloadFlash=false;new MutationObserver(()=>{const el=document.querySelector('.nexora-game-download');if(el&&el.getClientRects().length)window.downloadFlash=true}).observe(document,{subtree:true,childList:true})},mode);
  await page.goto(base+'/game/login');await page.waitForFunction(()=>!document.querySelector('[data-provider=line]').disabled);
  if(mode==='web'){await page.locator('.nexora-game-download').waitFor();assert.equal(await page.locator('.nexora-game-download').isVisible(),true)}else{assert.equal(await page.locator('.nexora-game-download').count(),0);assert.equal(await page.evaluate(()=>window.downloadFlash),false)}
  await page.close();
 }console.log('Download visibility: browser-only link; no link or first-frame flash in new/legacy desktop and Electron fallback');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
