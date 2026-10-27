const assert=require('node:assert/strict'),{gameLoginCompleteHtml}=require('../desktop/game-login-complete.cjs'),{startGameLogin}=require('../desktop/game-login-loopback.cjs');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const success of [true,false]){
  const page=await browser.newPage();await page.addInitScript(()=>{window.closeAttempts=0;window.close=()=>{window.closeAttempts++}});
  await page.route('https://complete.test/**',r=>r.fulfill({contentType:'text/html',body:gameLoginCompleteHtml(success)}));await page.goto('https://complete.test/auth?token=must-not-remain');
  assert.equal(await page.locator('h1').textContent(),success?'เข้าสู่เกมสำเร็จ':'กลับเข้าเกมไม่สำเร็จ');assert.equal(await page.evaluate(()=>window.closeAttempts),success?1:0);assert.ok(!page.url().includes('token='));assert.equal(await page.locator('body').evaluate(node=>node.getAnimations({subtree:true}).length),0,'No loading/spinner animations remain');await page.close();
 }
 const login=await startGameLogin({onToken:async()=>{throw Error('handoff failed')},timeoutMs:5000});try{const url=new URL(login.redirect);url.searchParams.set('token','test');const result=await fetch(url);assert.equal(result.status,502);assert.ok((await result.text()).includes('กลับเข้าเกมไม่สำเร็จ'));}finally{login.close()}
 console.log('Login completion: close attempted, blocked-close fallback has no spinner, tokens removed from URL and failed handoff never claims success');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
