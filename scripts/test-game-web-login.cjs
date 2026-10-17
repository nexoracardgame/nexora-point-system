const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 fs.mkdirSync('artifacts/game-web-login',{recursive:true});
 for(const [width,height]of [[1920,1080],[1366,768],[844,390],[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height}});let videos=0;
  await page.route('**/api/auth/session',route=>route.fulfill({json:{}}));
  await page.route('**/videos/nexora-login-4k/**',route=>route.abort());
  page.on('request',request=>{if(request.url().includes('/videos/nexora-login-4k/'))videos++});
  await page.goto('http://localhost:3010/game/login?callbackUrl=%2Fgame');
  await page.getByRole('heading',{name:'เข้าสู่ระบบเว็บไซต์'}).waitFor();
  await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).waitFor();
  await page.waitForFunction(()=>{const image=document.querySelector('.nexora-web-login-poster');return image.complete&&image.naturalWidth>0});
  assert.ok(videos>0,'Website requests its looping wallpaper; poster remains usable on a failed connection');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const main=await page.locator('.nexora-game-login').boundingBox();assert.ok(main.height>=height,'Login must fill viewport');
  const username=page.getByRole('textbox',{name:'Username',exact:true});await username.fill('webtester');
  const password=page.locator('input[name=password]');await password.fill('TestPassword12345');
  await page.getByRole('button',{name:'แสดงรหัสผ่าน',exact:true}).click();assert.equal(await password.getAttribute('type'),'text');
  await page.getByRole('button',{name:'ซ่อนรหัสผ่าน',exact:true}).click();assert.equal(await password.getAttribute('type'),'password');
  await page.getByRole('button',{name:'สมัครสมาชิกใหม่',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
  assert.equal(await page.locator('.nexora-game-back').count(),0);
  assert.equal(await page.getByRole('link',{name:'กลับเว็บไซต์ NEXORA'}).getAttribute('href'),'/game');
  for(const selector of ['.nexora-credential-field[data-field=username]','.nexora-credential-field[data-field=password]','.nexora-credential-submit']){const rect=await page.locator(selector).boundingBox();assert.ok(rect.width>100&&rect.height>20);assert.ok(rect.x>=0&&rect.x+rect.width<=width+1)}
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`artifacts/game-web-login/${width}.png`,fullPage:true});await page.close();console.log(`${width}x${height}: visible login, poster fallback on video failure, usable controls, register dialog and bounds passed`);
 }
 }finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
