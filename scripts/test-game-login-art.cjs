const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.GAME_TEST_URL||'http://localhost:3013';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const [width,height]of [[1920,1080],[2560,1440],[3840,2160],[844,390],[568,320],[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/videos/nexora-login-4k/**',route=>route.abort());
  await page.addInitScript(()=>{window.loginCalls=[];window.nexoraDesktop={isGameDesktop:true,windowControl:async()=>true,gameLogin:async provider=>{window.loginCalls.push(provider);return true},getVersion:async()=>'1.0.3'}});
  await page.goto(base+'/game/login');const line=page.getByRole('button',{name:'เข้าสู่ระบบด้วย LINE',exact:true});await line.waitFor();await page.waitForFunction(()=>!document.querySelector('[data-provider=line]').disabled);
  await page.waitForFunction(()=>[...document.querySelectorAll('.nexora-game-login img')].every(img=>img.complete&&img.naturalWidth>0));
  assert.equal(await page.locator('.nexora-game-download').count(),0,'Installed game never renders a PC download link');
  await page.locator('.nexora-window-controls .nexora-login-utilities').waitFor();
  const toolbar=await page.locator('.nexora-window-controls button').evaluateAll(buttons=>buttons.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}}));
  assert.ok(toolbar.length>=5,'Native toolbar contains utilities and window controls');
  for(let i=0;i<toolbar.length;i++){const r=toolbar[i];assert.ok(r.x>=0&&r.y>=0&&r.right<=width&&r.bottom<=height&&r.hit,'Toolbar button is visible and clickable');for(let j=0;j<i;j++){const a=toolbar[j];assert.ok(r.x>=a.right||r.right<=a.x||r.y>=a.bottom||r.bottom<=a.y,'Toolbar buttons never overlap')}}
  assert.ok((await page.locator('.nexora-credential-frame-art').getAttribute('src')).includes('form-v2.webp'));
  const slots=await page.locator('.nexora-credential-field').evaluateAll(fields=>fields.map(el=>({top:el.offsetTop/el.offsetParent.clientHeight,bottom:(el.offsetTop+el.offsetHeight)/el.offsetParent.clientHeight,left:el.offsetLeft/el.offsetParent.clientWidth,right:(el.offsetLeft+el.offsetWidth)/el.offsetParent.clientWidth})));
  assert.ok(slots[0].top>=.23&&slots[0].bottom<=.329&&slots[1].top>=.366&&slots[1].bottom<=.465,'Fields fit artwork slots');
  for(const slot of slots)assert.ok(slot.left>=.125&&slot.right<=.88,'Field text stays inside frame');
  for(const button of await page.locator('.nexora-game-login-actions button,.nexora-game-login-actions input,.nexora-login-rail button').all()){
   const b=await button.boundingBox();assert.ok(b&&b.x>=-1&&b.y>=-1&&b.x+b.width<=width+1&&b.y+b.height<=height+1,'Art button fits '+width);
   assert.equal(await button.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),true,'Button is clickable '+width+' '+await button.getAttribute('aria-label'));
  }
  assert.equal(await page.locator('[data-provider]').count(),4);
  for(const name of ['Facebook','Discord']){await page.getByRole('button',{name:'เข้าสู่ระบบด้วย '+name,exact:true}).click();await page.getByRole('status').filter({hasText:name+' ยังไม่เปิดให้บริการ'}).waitFor();assert.deepEqual(await page.evaluate(()=>window.loginCalls),[])}
  await line.click();await page.waitForFunction(()=>window.loginCalls.length===1);await page.getByRole('button',{name:'เข้าสู่ระบบด้วย Google',exact:true}).click();await page.waitForFunction(()=>window.loginCalls.length===2);assert.deepEqual(await page.evaluate(()=>window.loginCalls),['line','google']);
  await page.getByRole('textbox',{name:'Username',exact:true}).fill('x'.repeat(24));await page.locator('input[name=password]').fill('p'.repeat(128));assert.equal((await page.getByRole('textbox',{name:'Username',exact:true}).inputValue()).length,24);assert.equal((await page.locator('input[name=password]').inputValue()).length,128);
  await page.getByRole('textbox',{name:'Username',exact:true}).fill('test_player');await page.locator('input[name=password]').fill('test password 2026!');await page.getByRole('button',{name:'แสดงรหัสผ่าน',exact:true}).click();assert.equal(await page.locator('input[name=password]').getAttribute('type'),'text');await page.getByRole('button',{name:'ซ่อนรหัสผ่าน',exact:true}).click();
  await page.getByRole('button',{name:'ลืมรหัสผ่าน?',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
  await page.getByRole('button',{name:'สมัครสมาชิกใหม่',exact:true}).click();await page.getByRole('dialog',{name:'สมัครสมาชิก',exact:true}).waitFor();assert.equal(await page.locator('.nexora-register-form input').count(),3);await page.getByRole('button',{name:'ปิด',exact:true}).click();
  await page.getByRole('button',{name:'ตั้งค่าเสียง',exact:true}).click();await page.locator('.nexora-login-sound').click();assert.equal(await page.evaluate(()=>localStorage.getItem('triad-battle-muted')),'1');await page.keyboard.press('Escape');
  fs.mkdirSync('artifacts/game-login-art',{recursive:true});await page.screenshot({path:`artifacts/game-login-art/${width}x${height}.png`});assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Game login artwork: 7 viewports, framed credentials hit testing, four plain social icons, LINE/Google handoff, inactive providers, password visibility, signup/recovery dialogs and shared sound passed');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
