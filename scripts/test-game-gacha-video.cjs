const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-gacha-ui.cjs','utf8');
const {modules,css,compile}=new Function('require',fixture.slice(0,fixture.indexOf('(async()=>'))+'return {modules,css,compile};')(require);
modules['@/lib/login-wallpaper']=compile('lib/login-wallpaper.ts');
const bundle=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}require('react-dom/client').createRoot(document.getElementById('root')).render(require('react').createElement(require('./GameGachaBackground').default));`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 await page.route('http://video.test/**',route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/videos/')||path.startsWith('/images/'))return route.fulfill({path:'public'+path});return route.fulfill({contentType:'text/html; charset=utf-8',body:`<style>body{margin:0}${css}</style><section class="game-gacha"><div id="root"></div></section><script>${bundle}</script>`})});
 await page.goto('http://video.test/');await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.videoWidth===3840&&v.readyState>=2},{},{timeout:120000});
 const details=await page.locator('video').evaluate(async video=>{await video.play();const start=video.currentTime;await new Promise(resolve=>setTimeout(resolve,600));return {moving:video.currentTime>start,loop:video.loop,muted:video.muted,inline:video.playsInline,width:video.videoWidth}});
 assert.deepEqual(details,{moving:true,loop:true,muted:true,inline:true,width:3840});
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('video')).opacity==='1');await page.screenshot({path:'artifacts/game-gacha/video-background.png'});
 await page.evaluate(()=>{localStorage.setItem('triad-command-motion-off','1');window.dispatchEvent(new Event('nexora:motion-preference'))});assert.equal(await page.locator('video').evaluate(video=>video.paused),true);
 console.log('Gacha wallpaper: real login loader, 4K video decode, advancing playback, muted inline loop and motion pause passed');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
