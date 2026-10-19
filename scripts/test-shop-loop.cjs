const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),ts=require('typescript');
const{chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-coin-shop.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('\nconst script='))+'return modules;')(require);
modules.preview=ts.transpileModule(fs.readFileSync('components/GameCoinPreview.tsx','utf8'),{fileName:'preview.tsx',compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
modules['./GameCoinShop']='module.exports=require("shop");';modules['./GameCoinPreview.css']=' ';
const manifest=require('../public/game-assets/video/shop-loop-5/manifest.json');
const release=require('../public/game-release.json');
for(const resource of [manifest.poster,...manifest.variants.map(v=>v.url)])assert.ok(release.resources.some(r=>r.url===resource));
const css=['GameWebsite','GameCoinShop','GameCoinPreview','GameEntryBackground'].map(n=>fs.readFileSync('components/'+n+'.css','utf8')).join('\n');
const html=`<html><style>body{margin:0;background:#030405;color:white}*{box-sizing:border-box}${css}</style><div id="root"></div><script>const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root'));window.open=(...args)=>{window.opened=args};window.render=(preview)=>root.render(preview?React.createElement(require('preview').default,{onClose:()=>root.render(null)}):React.createElement(require('shop').default));render(false);</script></html>`;
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}const file=path.resolve('public','.'+url.pathname);if(!file.startsWith(path.resolve('public')+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',file.endsWith('.mp4')?'video/mp4':file.endsWith('.webp')?'image/webp':'application/octet-stream');fs.createReadStream(file).pipe(res);});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({channel:'chrome',headless:true});try{
 fs.mkdirSync('artifacts/shop-loop',{recursive:true});
 for(const[name,width,height,touch]of [['desktop',1920,1080,false],['4k',3840,2160,false],['mobile',844,390,true],['tablet',1180,820,true]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
  for(const preview of [false,true]){
   await page.evaluate(preview=>window.render(preview),preview);
   await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.readyState>=2&&v.currentTime>.1&&!v.paused;});
   assert.equal(await page.locator('.nx-coin-package').count(),6);assert.equal(await page.locator('video').count(),1);
   assert.equal(await page.locator('.nx-coin-scene>img').getAttribute('src'),manifest.poster);
   assert.ok(await page.locator('video').evaluate(v=>v.src.includes('/shop-loop-5/')&&v.loop&&v.muted));
   if(preview){
    const dialog=page.getByRole('dialog',{name:'เติม COIN'}),bounds=await dialog.boundingBox(),scene=await page.locator('.nx-coin-scene').boundingBox();
    assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1);
    assert.ok(Math.abs(scene.width-bounds.width)<4&&Math.abs(scene.height-bounds.height)<4);
    assert.equal(await page.locator('video').evaluate(v=>getComputedStyle(v).objectFit),'contain');
    assert.ok((await page.locator('video').evaluate(v=>v.videoWidth))<=1920,'Small preview never downloads 4K');
    const before=await page.locator('.nx-coin-scene').boundingBox();await page.locator('.game-coin-preview-body').evaluate(n=>n.scrollTop=n.scrollHeight);const after=await page.locator('.nx-coin-scene').boundingBox();assert.deepEqual(after,before,'Video remains fitted while content scrolls');
    await page.locator('.game-coin-preview-body').evaluate(n=>n.scrollTop=0);
    await page.screenshot({path:`artifacts/shop-loop/${name}-preview.png`});
    await page.locator('.nx-coin-package').first().click();assert.ok((await page.evaluate(()=>window.opened[0])).endsWith('/game/topup?pack=coin-35'));
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
   }else{
    await page.getByRole('radio').first().check();await page.getByRole('button',{name:'ชำระเงิน',exact:true}).click();await page.getByRole('heading',{name:'ยังไม่เปิดรับชำระเงิน'}).waitFor();await page.getByRole('button',{name:'ตกลง',exact:true}).click();await page.screenshot({path:`artifacts/shop-loop/${name}-web.png`});
   }
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Shop Loop 5: web/COIN preview, desktop/4K/mobile/tablet, contain fitting, scrolling, six real packages, checkout notice and external package link passed');
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}})().catch(e=>{console.error(e);server.closeAllConnections();server.close();process.exitCode=1});
