const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 await page.addInitScript(()=>{window.nexoraDesktop={isGameDesktop:true,getVersion:async()=>'1.0.0'}});
 const body='real patch test';const release={version:'live-test',authEpoch:1,minimumDesktopVersion:'1.0.0',totalBytes:Buffer.byteLength(body),resources:[{url:'/images/patch-test.bin',bytes:Buffer.byteLength(body),sha256:crypto.createHash('sha256').update(body).digest('hex')}]};
 await page.route('**/game-release.json',route=>route.fulfill({json:release}));let downloads=0;
 await page.route('**/images/patch-test.bin?*',async route=>{downloads++;await new Promise(resolve=>setTimeout(resolve,1200));await route.fulfill({body,contentType:'application/octet-stream'})});
 await page.goto('http://localhost:3013/game/login');await page.locator('.nexora-game-patch progress').waitFor();
 await page.getByRole('button',{name:/เข้าสู่ระบบด้วย LINE/}).waitFor({timeout:30000});assert.equal(downloads,1);
 assert.equal(await page.locator('.nexora-game-patch').count(),0);
 const pointer=await page.evaluate(async()=>await (await (await caches.open('nexora-game-release')).match('/game/release-pointer')).json());assert.equal(pointer.version,'live-test');
 await page.reload();await page.getByRole('button',{name:/เข้าสู่ระบบด้วย LINE/}).waitFor();assert.equal(downloads,1);
 const installer=await fetch('http://localhost:3013/downloads/game-windows/latest.yml');assert.equal(installer.status,200);assert.match(await installer.text(),/version: 1.0.0/);
 console.log('Live desktop bridge: actual browser CacheStorage, blocking patch UI, verified reload, no repeat download, updater feed passed');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
