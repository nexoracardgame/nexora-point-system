const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-gacha-ui.cjs','utf8');
const {modules,compile,css}=new Function('require',fixture.slice(0,fixture.indexOf('(async()=>'))+'return {modules,compile,css};')(require);
modules.controls=compile('components/GameWindowControls.tsx');modules.settings=compile('components/GameSettings.tsx');
modules['./GameWindowControls.css']='';modules['./GameSettings.css']='';modules['@/lib/game-window-mode']=compile('lib/game-window-mode.ts');modules['@/lib/game-settings']=compile('lib/game-settings.ts');
modules['next/navigation']='exports.usePathname=()=>window.path;';modules['next-auth/react']='exports.useSession=()=>({status:"authenticated",data:{user:{id:"test-owner"}}});exports.signOut=async()=>{};';modules['@/lib/battle-ui-state']='exports.useBattleArenaActive=()=>window.active;';
const bundle=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}window.calls=[];window.path='/game';window.active=false;window.nexoraDesktop={isGameDesktop:true,supportsNativeWindowModes:true,windowControl:async action=>{calls.push(action);return true}};const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(React.Fragment,null,React.createElement(require('controls').default),React.createElement(require('settings').default),React.createElement(require('gacha').default)));render();`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});fs.mkdirSync('artifacts/game-controls',{recursive:true});try{
 for(const [width,height] of [[1920,1080],[1366,768],[844,390],[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://controls.test/**',route=>{const path=new URL(route.request().url()).pathname;if(path==='/api/game-gacha')return route.fulfill({json:{coin:100,history:[],unlimitedCoin:true}});if(path.startsWith('/cards/')||path.startsWith('/images/'))return route.fulfill({path:'public'+path});return route.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><style>body{margin:0}${css}${fs.readFileSync('components/GameSettings.css','utf8')}${fs.readFileSync('components/GameWindowControls.css','utf8')}</style><div id="root" style="position:fixed;inset:0;overflow:hidden;isolation:isolate"></div><script>${bundle}</script>`})});
  await page.goto('http://controls.test/');
  for(const path of ['/game','/game/login','/game/pentad','/game/account','/game/topup']){
   await page.evaluate(path=>{window.path=path;window.active=path==='/game/pentad';render()},path);
   await page.getByRole('button',{name:'ตั้งค่าเกม',exact:true}).click();await page.getByRole('dialog',{name:'ตั้งค่าเกม',exact:true}).waitFor();await page.keyboard.press('Escape');
   for(const name of ['ย่อหน้าต่าง','สลับขนาดหน้าต่าง','ปิดเกม'])assert.equal(await page.getByRole('button',{name,exact:true}).isVisible(),true);
  }
  await page.evaluate(()=>{window.path='/game';window.active=false;render()});await page.evaluate(()=>window.dispatchEvent(new Event('nexora:open-gacha')));await page.locator('.game-gacha').waitFor();
  for(const mode of ['windowed','fullscreen']){
   await page.getByRole('button',{name:'ตั้งค่าเกม',exact:true}).click();await page.getByRole('combobox',{name:'โหมดหน้าจอ'}).selectOption(mode);await page.getByRole('button',{name:'ปิดตั้งค่า'}).click();
   const geometry=await page.evaluate(()=>{const a=document.querySelector('.nexora-settings-open'),b=document.querySelector('.nexora-window-controls'),wallet=document.querySelector('.gg-wallet'),x=a.getBoundingClientRect(),y=b.getBoundingClientRect(),w=wallet.getBoundingClientRect();return {gap:y.left-x.right,aligned:Math.abs(y.top+y.height/2-x.top-x.height/2)<1,hit:document.elementFromPoint(x.left+x.width/2,x.top+x.height/2)===a||a.contains(document.elementFromPoint(x.left+x.width/2,x.top+x.height/2)),overlap:w.left<y.right&&w.right>x.left&&w.top<y.bottom&&w.bottom>x.top}});
   assert.ok(geometry.gap>=3&&geometry.gap<=6);assert.equal(geometry.aligned,true);assert.equal(geometry.hit,true,'Settings must be above gacha portal');assert.equal(geometry.overlap,false,'Wallet must clear shared controls');
   assert.equal(await page.getByRole('button',{name:'ย่อหน้าต่าง',exact:true}).isVisible(),true);await page.screenshot({path:`artifacts/game-controls/${width}-${mode}.png`});
   await page.getByRole('button',{name:'ตั้งค่าเกม',exact:true}).click();await page.keyboard.press('Tab');await page.keyboard.press('Escape');assert.equal(await page.locator('.game-gacha').count(),1,'Settings Escape must not close scene beneath it');
  }
  await page.getByRole('button',{name:'สลับขนาดหน้าต่าง',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.gameWindowMode==='windowed');
  await page.getByRole('button',{name:'ย่อหน้าต่าง',exact:true}).click();assert.ok(await page.evaluate(()=>calls.includes('minimize')));await page.getByRole('button',{name:'ปิดเกม',exact:true}).click();await page.getByRole('button',{name:'ยกเลิก',exact:true}).click();assert.equal(await page.locator('.game-gacha').count(),1);assert.deepEqual(errors,[]);await page.close();console.log(`${width}x${height}: shared controls across routes, active battle, gacha portal, fullscreen, wallet clearance and keyboard passed`);
 }
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
