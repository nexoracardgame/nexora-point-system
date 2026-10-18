const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.GAME_TEST_URL||'http://localhost:3013';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const [width,height]of [[1920,1080],[844,390],[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/videos/nexora-login-4k/**',route=>route.abort());
  await page.addInitScript(()=>{window.__anonymousLoadingSeen=false;new MutationObserver(()=>{if(document.querySelector('.nexora-game-loading,.nexora-game-patch'))window.__anonymousLoadingSeen=true}).observe(document,{childList:true,subtree:true})});
  await page.goto(base+'/game?room=123456&spectate=1');await page.waitForURL('**/game/login?**');
  assert.equal(new URL(page.url()).searchParams.get('callbackUrl'),'/game?room=123456&spectate=1');
  await page.getByRole('button',{name:/เข้าสู่ระบบด้วย LINE/}).waitFor();await page.waitForFunction(()=>!document.querySelector('.nexora-game-loading'));
  assert.equal(await page.evaluate(()=>window.__anonymousLoadingSeen),false,'Anonymous entry must never show game/patch loading');
  await page.waitForFunction(()=>[...document.querySelectorAll('.nexora-game-login-actions button')].every(button=>!button.disabled));
  assert.equal(await page.title(),'NEXORA CARD GAME');for(const href of await page.locator('link[rel=manifest]').evaluateAll(links=>links.map(link=>link.getAttribute('href'))))assert.equal(href,'/game/manifest.webmanifest');
  const icons=await page.locator('link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]').evaluateAll(links=>links.map(link=>link.getAttribute('href')));assert.ok(icons.length>0);assert.ok(icons.every(href=>href.startsWith('/game-assets/branding/')&&href.includes('?v=')),'Only versioned game-specific icons');
  assert.equal(await page.locator('nav:not(.nexora-login-rail)').count(),0);assert.equal(await page.locator('.nexora-game-login').count(),1);
  for(const button of await page.locator('.nexora-game-login-actions button').all()){const b=await button.boundingBox();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1,'Login buttons fit '+width);assert.equal(await button.isEnabled(),true);}
  fs.mkdirSync('artifacts/game-platform',{recursive:true});await page.screenshot({path:`artifacts/game-platform/login-${width}.png`});assert.deepEqual(errors,[]);await page.close();
 }
 for(const [from,to]of [['/battle','/game'],['/battle/triad-dominion','/game'],['/battle/pentad-dominion','/game/pentad']]){const r=await fetch(base+from+'?room=123456&spectate=1',{redirect:'manual'});assert.equal(r.status,307);assert.equal(r.headers.get('location'),to+'?room=123456&spectate=1');}
 const manifest=await (await fetch(base+'/game/manifest.webmanifest')).json();assert.equal(manifest.name,'NEXORA CARD GAME');assert.equal(manifest.start_url,'/game');
 console.log('Live game login: branded tab/manifest, shared login providers, no site navigation, room callbacks, legacy redirects and 4 desktop/mobile viewports passed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
