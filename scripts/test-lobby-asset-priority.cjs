const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const compile = code => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const modules = {};
for (const [id,pkg,file] of [['react','react','react.production.js'],['react/jsx-runtime','react','react-jsx-runtime.production.js'],['react-dom','react-dom','react-dom.production.js'],['react-dom/client','react-dom','react-dom-client.production.js'],['scheduler','scheduler','scheduler.production.js']]) modules[id] = fs.readFileSync(path.join(path.dirname(require.resolve(pkg)), 'cjs', file), 'utf8');
modules['next/navigation'] = 'exports.usePathname=()=>"/battle/triad-dominion";';
modules['@/lib/game-ui-audio'] = 'exports.playGameUiSound=()=>{};';
modules['./BattleLoadingScreen.css'] = modules['./LobbyActionButton.css'] = '';
for (const [id,file] of [['@/lib/lobby-assets','lib/lobby-assets.ts'],['wallpaper','lib/home-wallpaper.ts'],['loading','components/BattleLoadingScreen.tsx'],['button','components/LobbyActionButton.tsx']]) modules[id] = compile(fs.readFileSync(file,'utf8'));
modules['./lobby-assets'] = 'module.exports=require("@/lib/lobby-assets");';
modules.app = compile(`import React,{useEffect} from 'react';import Loading from 'loading';import Button from 'button';import {loadHomeWallpaper} from 'wallpaper';export default function App(){useEffect(()=>{void loadHomeWallpaper().catch(()=>{})},[]);return <><Loading/><div className="nexora-command-lobby"><div className="nexora-command-actions">{['play','join','rank'].map(artwork=><Button key={artwork} artwork={artwork} title={artwork} subtitle="NEXORA" onClick={()=>{}}/>)}</div></div></>}`);
const bundle = Object.entries(modules).map(([id,code])=>`${JSON.stringify(id)}:function(require,module,exports){${code}\n}`).join(',');
const css = ['components/BattleLoadingScreen.css','components/LobbyActionButton.css'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
const html = `<html><head><style>${css}</style></head><body><div id="root"></div><script>const modules={${bundle}},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](require,m,m.exports);return m.exports;}require('react-dom/client').createRoot(document.getElementById('root')).render(require('react').createElement(require('app').default));</script></body></html>`;
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  for(const fail of [false,true]) {
   const page=await browser.newPage();let release,manifestRequests=0,artRequests=0;const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://assets.test/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/')return route.fulfill({body:html,contentType:'text/html'});
    if(url.pathname.endsWith('lobby-action-sprite.webp')) {
     artRequests++;if(fail)return route.abort();
     await new Promise(resolve=>{release=resolve});
    }
    if(url.pathname.endsWith('manifest.json')){manifestRequests++;return route.abort();}
    const file=path.resolve('public','.'+url.pathname);
    return fs.existsSync(file)?route.fulfill({body:fs.readFileSync(file)}):route.abort();
   });
   await page.goto('https://assets.test/',{waitUntil:'domcontentloaded'});
   await page.locator('.nexora-game-loading').waitFor();
   if(!fail){
    await page.waitForTimeout(3300);assert.equal(await page.locator('.nexora-game-loading').count(),1,'Loading screen waits for decoded button artwork on slow connections');
    assert.equal(manifestRequests,0,'4K wallpaper cannot compete with button artwork');release();
   }
   await page.locator('.nexora-game-loading').waitFor({state:'detached',timeout:5000});
   assert.equal(artRequests,1,'All three buttons and preloader share one artwork request');
   assert.equal(await page.locator('.nexora-lobby-art-crop').first().evaluate(el=>getComputedStyle(el,'::before').content),'""','A gold-framed CSS fallback is always present');
   if(!fail)assert.equal(await page.locator('.nexora-lobby-art-crop img').evaluateAll(els=>els.every(el=>el.complete&&el.naturalWidth===1920)),true);
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('Lobby artwork: slow-network decode gate, one shared request, video priority and network-error fallback passed');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
