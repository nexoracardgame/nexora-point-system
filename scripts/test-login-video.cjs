const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}});
 await page.route('**/videos/nexora-login-4k/manifest.json',async route=>{await new Promise(resolve=>setTimeout(resolve,800));await route.continue()});
 await page.goto('http://localhost:3013/game/login');
 assert.equal(await page.locator('.nexora-game-login-scene').count(),0,'No static wallpaper flashes while the video loads');
 await page.waitForFunction(()=>{const v=document.querySelector('.nexora-game-login-video');return v&&v.videoWidth===3840&&v.readyState>=2},{},{timeout:120000});
 const details=await page.locator('video').evaluate(async v=>{await v.play();const before=v.currentTime;await new Promise(resolve=>setTimeout(resolve,500));const moving=v.currentTime!==before;v.currentTime=v.duration-.1;await new Promise(resolve=>setTimeout(resolve,500));return {width:v.videoWidth,height:v.videoHeight,loop:v.loop,muted:v.muted,moving,wrapped:v.currentTime<1}});
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('video')).opacity==='1');
 await page.reload();assert.equal(await page.locator('.nexora-game-login-scene').count(),0,'Refresh never reveals the old static wallpaper');
 assert.deepEqual(details,{width:3840,height:2160,loop:true,muted:true,moving:true,wrapped:true});console.log('Original first 4K login video: decoded 3840x2160, moving pixels/time, muted inline autoplay and end-to-start loop verified');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
