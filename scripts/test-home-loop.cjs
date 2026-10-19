const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { chromium } = require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const manifest = require('../public/game-assets/video/home-loop/manifest.json');
const modules = {};
for (const [id, pkg, file] of [['react','react','react.production.js'],['react/jsx-runtime','react','react-jsx-runtime.production.js'],['react-dom','react-dom','react-dom.production.js'],['react-dom/client','react-dom','react-dom-client.production.js'],['scheduler','scheduler','scheduler.production.js']]) {
  modules[id] = fs.readFileSync(path.join(path.dirname(require.resolve(pkg)), 'cjs', file), 'utf8');
}
modules['lucide-react'] = fs.readFileSync(require.resolve('lucide-react'), 'utf8');
modules['./BattleAudio'] = 'exports.primeBattleAudio=async()=>{};';
modules['./lobby-assets'] = 'exports.loadLobbyAssets=()=>Promise.resolve();';
modules['../public/game-assets/video/home-loop/manifest.json'] = `module.exports=${JSON.stringify(manifest)};`;
for (const [id, file] of [['@/lib/home-wallpaper','lib/home-wallpaper.ts'],['scene','app/(main)/battle/triad-dominion/NexoraCommandScene.tsx']]) {
  modules[id] = ts.transpileModule(fs.readFileSync(file,'utf8'), {fileName:file, compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
}
const bundle = Object.entries(modules).map(([id,code])=>`${JSON.stringify(id)}:function(require,module,exports){${code}\n}`).join(',');
const css = fs.readFileSync('app/(main)/battle/triad-dominion/NexoraCommand.css','utf8');
const html = `<html><style>body{margin:0;background:black}${css}</style><div id="root"></div><script>const modules={${bundle}},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](require,m,m.exports);return m.exports;}const root=require('react-dom/client').createRoot(document.getElementById('root'));window.renderScene=homeVideo=>root.render(require('react').createElement(require('scene').default,{homeVideo}));renderScene(true);</script></html>`;
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}
  const file=path.resolve('public','.'+pathname);
  if(!file.startsWith(path.resolve('public')+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
  const size=fs.statSync(file).size,range=/bytes=(\d+)-(\d*)/.exec(req.headers.range||''),start=range?+range[1]:0,end=range?.[2]?Math.min(+range[2],size-1):size-1;
  res.writeHead(range?206:200,{'Content-Type':file.endsWith('.mp4')?'video/mp4':'image/webp','Content-Length':end-start+1,'Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
  fs.createReadStream(file,{start,end}).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  fs.mkdirSync('artifacts/home-loop',{recursive:true});
  for(const [name,width,height,mobile,expected] of [['desktop',1920,1080,false,1920],['4k',3840,2160,false,3840],['mobile',844,390,true,1280]]) {
   const page=await browser.newPage({viewport:{width,height},isMobile:mobile,hasTouch:mobile});const errors=[];
   await page.addInitScript(()=>Object.defineProperty(navigator,'deviceMemory',{get:()=>8}));
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(`http://127.0.0.1:${server.address().port}`);
   await page.waitForFunction(w=>document.querySelector('video')?.videoWidth===w,expected);
   await page.waitForFunction(()=>document.querySelector('video')?.currentTime>.1);
   assert.equal(await page.locator('video').evaluate(v=>v.loop&&v.muted&&v.playsInline),true);
   assert.ok(await page.locator('video').evaluate(v=>v.src.includes('/game-assets/video/home-loop/')));
   await page.screenshot({path:`artifacts/home-loop/${name}.png`});
   await page.locator('video').evaluate(v=>{v.currentTime=9.7});
   await page.waitForFunction(()=>document.querySelector('video')?.currentTime<2);
   await page.locator('button[aria-label="หยุดการเคลื่อนไหว"]').evaluate(button=>button.click());
   await page.waitForFunction(()=>document.querySelector('video')?.paused);
   assert.equal(await page.locator('video').evaluate(v=>v.paused),true);
   await page.evaluate(()=>renderScene(false));
   await page.locator('video').waitFor({state:'detached'});
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('Home loop: desktop/4K/mobile resolution, playback, seamless repeat, mute, pause and home-only scope passed');
 } finally {await browser.close();server.closeAllConnections();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
