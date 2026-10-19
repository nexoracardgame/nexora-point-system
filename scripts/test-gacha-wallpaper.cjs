const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-home-loop.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle ='))+'return modules;')(require);
modules.background=ts.transpileModule(fs.readFileSync('components/GameGachaBackground.tsx','utf8'),{fileName:'background.tsx',compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
modules['@/lib/login-wallpaper']='exports.loadLoginWallpaper=async()=>{throw Error("Legacy video requested")};';
const manifest=require('../public/game-assets/video/home-loop-2/manifest.json');
const css=fs.readFileSync('components/GameGacha.css','utf8');
const html=`<html><style>html,body,#root{margin:0;height:100%;background:black}${css}</style><div id="root"></div><script>const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root'));window.render=(shared=false)=>root.render(React.createElement('section',{className:'game-gacha'},React.createElement(require('background').default,{homeLoop:true}),shared&&React.createElement('aside',{className:'gg-rates'},React.createElement(require('background').default,{shared:true}))));render();</script></html>`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://local');if(url.pathname==='/'){res.setHeader('Content-Type','text/html');return res.end(html);}
 const file=path.resolve('public','.'+url.pathname);if(!file.startsWith(path.resolve('public')+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',file.endsWith('.mp4')?'video/mp4':file.endsWith('.webp')?'image/webp':'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({channel:'chrome',headless:true});
 try{fs.mkdirSync('artifacts/gacha-wallpaper',{recursive:true});
 for(const [name,width,height,touch,quality]of [['desktop',1920,1080,false,'1080p'],['4k',3840,2160,false,'4k'],['mobile',844,390,true,'720p'],['tablet',1180,820,true,'720p']]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch});const page=await context.newPage();const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.route('**/*.mp4',async route=>{await new Promise(resolve=>setTimeout(resolve,1200));await route.continue();});
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
  await page.locator('.gg-background>img').waitFor();
  assert.equal(await page.locator('.gg-background>img').getAttribute('src'),manifest.poster);
  assert.equal(await page.locator('.gg-background').evaluate(n=>getComputedStyle(n).backgroundImage),'none');
  assert.equal(await page.locator('.game-gacha').evaluate(n=>getComputedStyle(n).backgroundImage),'none');
  await page.screenshot({path:`artifacts/gacha-wallpaper/${name}-cold.png`});
  await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.readyState>=2&&v.currentTime>.1&&!v.paused;});
  assert.ok(await page.locator('video').evaluate((v,q)=>v.src.includes('loop-'+q+'-')&&v.loop&&v.muted&&v.playsInline,quality));
  await page.screenshot({path:`artifacts/gacha-wallpaper/${name}-playing.png`});
  await page.evaluate(()=>window.render(true));await page.waitForFunction(()=>document.querySelectorAll('video').length===2&&[...document.querySelectorAll('video')].every(v=>v.readyState>=2));
  const urls=await page.locator('video').evaluateAll(vs=>vs.map(v=>v.src));assert.equal(urls[0],urls[1]);
  assert.ok(!requests.some(url=>url.includes('nexora-command-original')||url.includes('nexora-world-small')||url.includes('nexora-login-4k')));
  await page.evaluate(()=>{localStorage.setItem('triad-command-motion-off','1');window.dispatchEvent(new Event('nexora:motion-preference'));});await page.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>v.paused));
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Gacha Loop 2: desktop/4K/mobile/tablet, cold-entry poster, no old-image requests, playing/muted/looping, shared rates and motion pause passed');
 }finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.closeAllConnections();server.close();process.exitCode=1;});
