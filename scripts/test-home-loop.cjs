const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { chromium } = require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const manifest = require('../public/game-assets/video/home-loop-2/manifest.json');
const preparationManifest = require('../public/game-assets/video/home-loop/manifest.json');
const {createHash}=require('node:crypto');
const release=require('../public/game-release.json');
const homeFiles=[manifest.poster,...manifest.variants.map(item=>item.url)].map(url=>path.basename(url));
assert.deepEqual(fs.readdirSync('public/game-assets/video/home-loop-2').sort(),['manifest.json',...homeFiles].sort(),'No obsolete Loop 2 files remain');
for(const item of manifest.variants){const bytes=fs.readFileSync('public'+item.url);assert.equal(bytes.length,item.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);assert.ok(release.resources.some(resource=>resource.url===item.url&&resource.sha256===item.sha256),'New Loop 2 must be in the verified patch');}
const modules = {};
for (const [id, pkg, file] of [['react','react','react.production.js'],['react/jsx-runtime','react','react-jsx-runtime.production.js'],['react-dom','react-dom','react-dom.production.js'],['react-dom/client','react-dom','react-dom-client.production.js'],['scheduler','scheduler','scheduler.production.js']]) {
  modules[id] = fs.readFileSync(path.join(path.dirname(require.resolve(pkg)), 'cjs', file), 'utf8');
}
modules['lucide-react'] = fs.readFileSync(require.resolve('lucide-react'), 'utf8');
modules['./BattleAudio'] = 'exports.primeBattleAudio=async()=>{};';
modules['./lobby-assets'] = 'exports.loadLobbyAssets=()=>Promise.resolve();';
modules['../public/game-assets/video/home-loop-2/manifest.json'] = `module.exports=${JSON.stringify(manifest)};`;
modules['../public/game-assets/video/home-loop/manifest.json'] = `module.exports=${JSON.stringify(preparationManifest)};`;
for (const [id, file] of [['@/lib/home-wallpaper','lib/home-wallpaper.ts'],['scene','app/(main)/battle/triad-dominion/NexoraCommandScene.tsx']]) {
  modules[id] = ts.transpileModule(fs.readFileSync(file,'utf8'), {fileName:file, compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
}
for (const [id,file] of [['./GamePreparationBackground','components/GamePreparationBackground.tsx'],['waiting','components/BattleWaitingRoom.tsx'],['deck','components/DeckPreparation.tsx']]) {
  modules[id] = ts.transpileModule(fs.readFileSync(file,'utf8'), {fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
}
modules['./GamePreparationBackground.css'] = modules['./BattleWaitingRoom.css'] = '';
const lobbySource=fs.readFileSync('app/(main)/battle/triad-dominion/TriadDominionClient.tsx','utf8');
const lobbyScene=lobbySource.match(/<NexoraCommandScene [^\n]+?<div className="nexora-command-shade" \/>/)?.[0];
assert.ok(lobbyScene,'Use the actual lobby background JSX');
modules.play=ts.transpileModule(`import React,{useState} from 'react';import NexoraCommandScene from 'scene';export default function Play(){const[panel,setPanel]=useState(null);return <div className="nexora-command-lobby">${lobbyScene}<button id="test-play" style={{position:'fixed',zIndex:100,left:0,top:0}} onClick={()=>setPanel(panel?null:'create')}>PLAY</button><span id="panel-state">{panel||'home'}</span></div>}`,{fileName:'play.tsx',compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
const bundle = Object.entries(modules).map(([id,code])=>`${JSON.stringify(id)}:function(require,module,exports){${code}\n}`).join(',');
const css = ['app/(main)/battle/triad-dominion/NexoraCommand.css','components/BattleHud.css','components/BattleWaitingRoom.css','components/GamePreparationBackground.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n')+fs.readFileSync('app/(main)/battle/pentad-dominion/PentadDominion.module.css','utf8').replace(/\.shell\b/g,'.test-pentad');
const html = `<html><style>body{margin:0;background:black}${css}</style><div id="root"></div><script>const modules={${bundle}},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](require,m,m.exports);return m.exports;}const root=require('react-dom/client').createRoot(document.getElementById('root'));window.renderScene=(homeVideo,videoScene='home')=>root.render(require('react').createElement(require('scene').default,{homeVideo,videoScene,key:videoScene}));renderScene(true);</script></html>`;
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
   assert.ok(await page.locator('video').evaluate(v=>v.src.includes('/game-assets/video/home-loop-2/')));
   await page.screenshot({path:`artifacts/home-loop/${name}.png`});
   await page.locator('video').evaluate(v=>{v.currentTime=9.7});
   await page.waitForFunction(()=>document.querySelector('video')?.currentTime<2);
   await page.locator('button[aria-label="หยุดการเคลื่อนไหว"]').evaluate(button=>button.click());
   await page.waitForFunction(()=>document.querySelector('video')?.paused);
   assert.equal(await page.locator('video').evaluate(v=>v.paused),true);
   await page.evaluate(()=>renderScene(false));
   await page.locator('video').waitFor({state:'detached'});
   await page.evaluate(()=>{localStorage.removeItem('triad-command-motion-off');root.render(require('react').createElement(require('play').default));});
   await page.waitForFunction(()=>document.querySelector('video')?.currentTime>.1);
   const homeSource=await page.locator('video').getAttribute('src');
   await page.locator('video').evaluate(v=>{v.dataset.identity='original';v.currentTime=3;});
   await page.waitForFunction(()=>!document.querySelector('video').seeking);
   for(const expectedPanel of ['create','home']){
    await page.locator('#test-play').click();await page.waitForFunction(state=>document.querySelector('#panel-state').textContent===state,expectedPanel);
    assert.equal(await page.locator('video').getAttribute('src'),homeSource,'PLAY retains the home clip');
    assert.equal(await page.locator('video').getAttribute('data-identity'),'original','PLAY never remounts the video');
    assert.ok(await page.locator('video').evaluate(v=>v.currentTime>=3),'PLAY never restarts playback');
   }
   for(const mode of ['waiting','deck','pentad-waiting','pentad-deck']) {
    await page.evaluate(mode=>{
      localStorage.removeItem('triad-command-motion-off');
      const React=require('react'),h=React.createElement;
      const child=mode.endsWith('waiting')?h(require('waiting').default,{seats:{host:null,challenger:null},spectators:[],userId:'test',leaderId:'test',modes:[{id:'all',title:'ALL CARDS',description:''}],mode:'all',canChange:true,onMode:()=>{},onWatch:()=>{},onTake:()=>{window.actionWorked=true},onBot:()=>{}}):h(require('deck').DeckPreparationLayout,{tray:h('h2',null,'DECK'),catalog:h('button',{onClick:()=>{window.actionWorked=true}},'Select card')});
      root.render(h('div',{className:'nexora-battle-shell',style:{width:'100vw',height:'100vh'}},h('main',{className:mode.startsWith('pentad')?'test-pentad':mode==='waiting'?'nexora-command triad-room-screen':'nexora-command-deck triad-deck-screen nexora-deck-screen'},child)));
    },mode);
    await page.waitForFunction(()=>document.querySelector('video')?.currentTime>.1);
    assert.ok(await page.locator('video').evaluate(v=>v.src.includes('/game-assets/video/home-loop/')));
    assert.equal(await page.locator('video').evaluate(v=>v.muted&&v.loop&&v.playsInline),true);
    assert.equal(await page.locator('video').count(),1);
    await page.screenshot({path:`artifacts/home-loop/${name}-${mode}.png`});
    await page.locator(mode.endsWith('waiting')?'.nsw-seat-actions button':'.nexora-deck-catalog button').first().click();
    assert.equal(await page.evaluate(()=>window.actionWorked),true);
    await page.evaluate(()=>{window.actionWorked=false;localStorage.setItem('triad-command-motion-off','1');window.dispatchEvent(new Event('nexora:motion-preference'));});
    await page.waitForFunction(()=>document.querySelector('video')?.paused);
    await page.evaluate(()=>renderScene(false));
    await page.locator('video').waitFor({state:'detached'});
   }
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('Home Loop 2 + waiting/deck Loop 1: desktop/4K/mobile resolution, playback, repeat, mute, pause, controls and scene cleanup passed');
 } finally {await browser.close();server.closeAllConnections();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
