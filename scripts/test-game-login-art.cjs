const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.GAME_TEST_URL||'http://localhost:3013';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const [width,height]of [[1920,1080],[2560,1440],[3840,2160],[844,390],[568,320],[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.loginCalls=[];window.nexoraDesktop={isGameDesktop:true,gameLogin:async provider=>{window.loginCalls.push(provider);return true},getVersion:async()=>'1.0.2'}});
  await page.goto(base+'/game/login');const line=page.getByRole('button',{name:'เข้าสู่ระบบด้วย LINE',exact:true});await line.waitFor();await page.waitForFunction(()=>!document.querySelector('[data-provider=line]').disabled);
  await page.waitForFunction(()=>[...document.querySelectorAll('.nexora-game-login img')].every(img=>img.complete&&img.naturalWidth>0));
  for(const button of await page.locator('.nexora-game-login-actions button,.nexora-login-rail button').all()){
   const b=await button.boundingBox();assert.ok(b&&b.x>=-1&&b.y>=-1&&b.x+b.width<=width+1&&b.y+b.height<=height+1,'Art button fits '+width);
   assert.equal(await button.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),true,'Button is clickable '+width);
  }
  for(const name of ['Facebook','Discord','Apple']){await page.getByRole('button',{name:'เข้าสู่ระบบด้วย '+name,exact:true}).click();await page.getByRole('status').filter({hasText:name+' ยังไม่เปิดให้บริการ'}).waitFor();assert.deepEqual(await page.evaluate(()=>window.loginCalls),[])}
  await line.click();await page.waitForFunction(()=>window.loginCalls.length===1);await page.getByRole('button',{name:'เข้าสู่ระบบด้วย Google',exact:true}).click();await page.waitForFunction(()=>window.loginCalls.length===2);assert.deepEqual(await page.evaluate(()=>window.loginCalls),['line','google']);
  await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await page.getByRole('dialog',{name:'เข้าสู่ระบบ',exact:true}).waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
  await page.getByRole('button',{name:'สมัครสมาชิก',exact:true}).click();await page.getByRole('dialog',{name:'สมัครสมาชิก',exact:true}).waitFor();await page.getByRole('button',{name:'ปิด',exact:true}).click();
  await page.getByRole('button',{name:'ตั้งค่าเสียง',exact:true}).click();await page.locator('.nexora-login-sound').click();assert.equal(await page.evaluate(()=>localStorage.getItem('triad-battle-muted')),'1');await page.keyboard.press('Escape');
  fs.mkdirSync('artifacts/game-login-art',{recursive:true});await page.screenshot({path:`artifacts/game-login-art/${width}x${height}.png`});assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Game login artwork: 7 viewports, all images loaded, hit testing, actual LINE/Google handoff, inactive providers, login/register dialogs, Escape and shared sound preference passed');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
