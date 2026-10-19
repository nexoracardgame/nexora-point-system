const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict'), ts = require('typescript');
const { createHash } = require('node:crypto');
const { chromium } = require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const manifest = require('../public/game-assets/video/entry-loop-3/manifest.json');
const release = require('../public/game-release.json');
for (const item of manifest.variants) {
  const bytes = fs.readFileSync('public' + item.url);
  assert.equal(bytes.length, item.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
  assert.ok(release.resources.some(resource => resource.url === item.url && resource.sha256 === item.sha256));
}
for (const file of ['components/GameLoginView.tsx', 'components/BattleConnectingScreen.tsx', 'components/GamePatchGate.tsx']) {
  assert.ok(fs.readFileSync(file, 'utf8').includes('<GameEntryBackground'), file);
}
const modules = {};
require('./game-wallpaper-test-modules.cjs')(modules);
for (const [id, pkg, file] of [['react','react','react.production.js'],['react/jsx-runtime','react','react-jsx-runtime.production.js'],['react-dom','react-dom','react-dom.production.js'],['react-dom/client','react-dom','react-dom-client.production.js'],['scheduler','scheduler','scheduler.production.js']]) {
  modules[id] = fs.readFileSync(path.join(path.dirname(require.resolve(pkg)), 'cjs', file), 'utf8');
}
modules['lucide-react'] = fs.readFileSync(require.resolve('lucide-react'), 'utf8');
modules['@/lib/game-ui-audio'] = 'exports.playGameUiSound=()=>{};';
modules['@/lib/game-desktop-runtime'] = 'exports.isInstalledGameRuntime=()=>false;';
modules['../public/game-assets/video/entry-loop-3/manifest.json'] = 'module.exports=' + JSON.stringify(manifest);
for (const [id, file] of [['@/lib/game-entry-wallpaper','lib/game-entry-wallpaper.ts'],['./GameEntryBackground','components/GameEntryBackground.tsx'],['login','components/GameLoginView.tsx'],['loading','components/BattleConnectingScreen.tsx']]) {
  modules[id] = ts.transpileModule(fs.readFileSync(file, 'utf8'), {fileName:file, compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
}
for (const id of ['./GameEntryBackground.css','./BattleLoadingScreen.css','./BattleMobileOverlays.css','@/app/login/GameLogin.css','./GameEmailVerification.css']) modules[id] = ' ';
const css = ['app/login/GameLogin.css','components/WebGameLogin.css','components/BattleLoadingScreen.css','components/GamePatchGate.css','components/GameEntryBackground.css'].map(file => fs.readFileSync(file,'utf8')).join('\n');
const html = `<html><style>html,body,#root{margin:0;width:100%;height:100%;background:#030405}${css}</style><div id="root"></div><script>
const modules=${JSON.stringify(modules)},memo={};function require(id){if(memo[id])return memo[id].exports;const m=memo[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports;}
const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root'));
window.render=(screen)=>root.render(screen==='loading'?React.createElement(require('loading').default):screen==='patch'?React.createElement('div',{className:'nexora-game-patch'},React.createElement(require('./GameEntryBackground').default),React.createElement('progress',{value:50,max:100})):React.createElement('div',{className:screen==='web'?'nexora-web-login':'',style:{height:'100%'}},React.createElement(require('login').default,{busy:false,checking:false,error:'',onLogin:()=>{},onCredentials:async()=>{}})));
render('web');</script></html>`;
const server = http.createServer((req,res) => {
  const url = new URL(req.url,'http://local');
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');return res.end(html);}
  const file=path.resolve('public','.'+url.pathname);
  if(!file.startsWith(path.resolve('public')+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',file.endsWith('.mp4')?'video/mp4':file.endsWith('.webp')?'image/webp':'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    fs.mkdirSync('artifacts/entry-loop',{recursive:true});
    for(const [name,width,height,touch,expected] of [['desktop',1920,1080,false,'1080p'],['4k',3840,2160,false,'4k'],['mobile',844,390,true,'720p'],['tablet',1180,820,true,'720p']]) {
      const context=await browser.newContext({viewport:{width,height},hasTouch:touch});
      const page=await context.newPage();
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:'+server.address().port);
      for(const screen of ['web','login','loading','patch']) {
        await page.evaluate(screen=>window.render(screen),screen);
        await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.readyState>=2&&!v.paused&&v.currentTime>0.1;});
        assert.ok(await page.locator('video').evaluate((v,expected)=>v.src.includes('loop-'+expected+'-'),expected));
        assert.ok(await page.locator('video').evaluate(v=>v.loop&&v.muted&&v.playsInline&&v.videoWidth>0));
        const bounds=await page.locator('.nexora-entry-background').boundingBox();
        assert.ok(bounds.width>=width-1&&bounds.height>=height-1);
        await page.screenshot({path:`artifacts/entry-loop/${name}-${screen}.png`});
      }
      await page.locator('video').evaluate(v=>v.currentTime=v.duration-0.12);
      await page.waitForFunction(()=>document.querySelector('video').currentTime<2);
      await page.evaluate(()=>{localStorage.setItem('triad-command-motion-off','1');window.dispatchEvent(new Event('nexora:motion-preference'));});
      await page.waitForFunction(()=>document.querySelector('video').paused);
      await page.emulateMedia({reducedMotion:'reduce'});
      assert.ok(await page.locator('.nexora-entry-background img').evaluate(img=>img.complete&&img.naturalWidth>0));
      assert.deepEqual(errors,[]);
      await context.close();
    }
    const context=await browser.newContext();const page=await context.newPage();
    await page.route('**/*.mp4',route=>route.abort());
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.waitForFunction(()=>!document.querySelector('video'));
    assert.ok(await page.locator('.nexora-entry-background img').evaluate(img=>img.complete&&img.naturalWidth>0));
    await context.close();
    console.log('Entry Loop 3: integrity/registry, web/game login, loading/patch, desktop/4K/mobile/tablet, playback/loop/mute, motion preference and failed-video poster passed');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
