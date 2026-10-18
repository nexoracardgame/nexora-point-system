const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const css=fs.readFileSync('components/GameLobbyWallet.css','utf8');
 const original=css.slice(css.indexOf('.nexora-lobby-wallet {'));
 fs.mkdirSync('artifacts/game-wallet',{recursive:true});
 for(const [width,height] of [[1920,1080],[1366,768],[844,390],[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height}});
  await page.setContent(`<style>body{margin:0;background:#110d0b}main{container-type:size;width:100vw;height:100vh}</style><style id="wallet">${original}</style><main><div class="nexora-lobby-wallet"><button class="game-currency gem" onclick="window.clicked='nex'"><span>0</span><small>NEX</small></button><button class="game-currency coin" onclick="window.clicked='coin'"><span>0</span><small>COIN</small></button></div></main>`);
  const bounds=()=>page.locator('.game-currency').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}));
  const before=await bounds();await page.locator('#wallet').evaluate((n,style)=>n.textContent=style,css);assert.deepEqual(await bounds(),before,'Glow must not change geometry');
  const colors=await page.locator('.game-currency').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).getPropertyValue('--wallet-light').trim()));assert.deepEqual(colors,['#7cddf0','#f5d381']);
  const angle=()=>page.locator('.coin').evaluate(n=>getComputedStyle(n,'::after').getPropertyValue('--wallet-orbit-angle'));
  const start=await angle();await page.waitForTimeout(120);assert.notEqual(await angle(),start);
  await page.locator('.coin').evaluate(n=>n.click());assert.equal(await page.evaluate(()=>window.clicked),'coin');
  await page.screenshot({path:`artifacts/game-wallet/glow-${width}.png`});
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.coin').evaluate(n=>getComputedStyle(n,'::after').animationName),'none');
  await page.close();console.log(`${width}x${height}: unchanged geometry, cyan/gold orbit, click and reduced motion passed`);
 }
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
