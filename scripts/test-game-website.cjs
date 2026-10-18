const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-settings-ui.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle='))+'return modules;')(require);
modules.website=ts.transpileModule(fs.readFileSync('components/GameWebsite.tsx','utf8'),{compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
modules['./GameWebsite.css']='';
modules['@/lib/game-world-sections']=ts.transpileModule(fs.readFileSync('lib/game-world-sections.ts','utf8'),{compilerOptions:{module:1,target:9}}).outputText;
for(const name of ['triad-dominion','game-card-art','game-monsters']){modules['@/lib/'+name]=ts.transpileModule(fs.readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:1,target:9,esModuleInterop:true}}).outputText;modules['./'+name]='module.exports=require("@/lib/'+name+'");'}
for(const name of ['card-art','card-skill-db'])modules['@/public/cards/'+name+'.json']='module.exports='+fs.readFileSync('public/cards/'+name+'.json','utf8');
modules['@/lib/login-wallpaper']='exports.loadLoginWallpaper=async()=>{throw Error("fixture fallback")};';
modules['./GameBattleTutorials']=ts.transpileModule(fs.readFileSync('components/GameBattleTutorials.tsx','utf8'),{compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
modules['@/lib/game-battle-tutorials']=ts.transpileModule(fs.readFileSync('lib/game-battle-tutorials.ts','utf8'),{compilerOptions:{module:1,target:9}}).outputText;modules['./GameBattleTutorials.css']='';
modules['next-auth/react']="exports.useSession=()=>window.sessionState;exports.signOut=async()=>{window.signedOut=true}";
modules['next/link']="module.exports={__esModule:true,default:props=>require('react').createElement('a',props)}";
const script=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}window.sessionState={status:'unauthenticated',data:null};const root=require('react-dom/client').createRoot(document.getElementById('root'));window.render=()=>root.render(require('react').createElement(require('website').default));render();`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 fs.mkdirSync('artifacts/game-website',{recursive:true});
 for(const [width,height]of [[1920,1080],[1366,768],[844,390],[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height}});
  await page.route('http://website.test/**',async route=>{const pathname=new URL(route.request().url()).pathname;if(pathname.startsWith('/images/')||pathname.startsWith('/game-assets/')||pathname.startsWith('/cards/'))return route.fulfill({body:fs.readFileSync('public'+pathname),contentType:'image/webp'});if(pathname==='/api/game-wallet')return route.fulfill({json:{coin:1234,nexPoint:5678}});return route.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><style>body{margin:0}${fs.readFileSync('components/GameWebsite.css','utf8')}${fs.readFileSync('components/GameBattleTutorials.css','utf8')}</style><div id="root"></div><script>${script}</script>`})});
  await page.goto('http://website.test/');await page.getByRole('heading',{name:'NEXORA CARD GAME'}).waitFor();
  await page.evaluate(()=>document.querySelectorAll('img').forEach(image=>{image.loading='eager'}));
  await page.waitForFunction(()=>Array.from(document.images).every(image=>image.complete&&image.naturalWidth>0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow');
  await page.evaluate(()=>Promise.all(document.getAnimations().map(animation=>animation.finished)));
  await page.screenshot({path:`artifacts/game-website/${width}.png`,fullPage:true});
  assert.deepEqual(await page.locator('.nx-site-nav nav>:is(a,button)').allTextContents(),['ข่าว','โลกของ NEXORA','บทสอนต่อสู้','ดาวน์โหลด','เติม COIN']);
  const world=page.getByRole('button',{name:'โลกของ NEXORA',exact:true});await world.hover();await page.locator('#nx-world-menu').waitFor();assert.deepEqual(await page.locator('#nx-world-menu a').allTextContents(),['ธาตุ','ตัวละคร','เนื้อเรื่อง']);assert.deepEqual(await page.locator('#nx-world-menu a').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href'))),['/game/world/elements','/game/world/characters','/game/world/story']);const menu=await page.locator('#nx-world-menu').boundingBox();assert.ok(menu.x>=0&&menu.x+menu.width<=width);await page.locator('#nx-world-menu a').first().hover();await page.waitForTimeout(200);assert.equal(await world.getAttribute('aria-expanded'),'true');await page.screenshot({path:`artifacts/game-website/world-menu-${width}.png`});await page.keyboard.press('Escape');await page.locator('#nx-world-menu').waitFor({state:'detached'});await world.focus();await page.keyboard.press('ArrowDown');await page.locator('#nx-world-menu a').first().waitFor();await page.waitForFunction(()=>document.activeElement?.textContent==='ธาตุ');await page.keyboard.press('Escape');
  assert.equal(await page.locator('#monsters,.nx-site-monsters').count(),0,'Monster website section removed');
  assert.equal(await page.locator('#information,#world,.nx-site-world').count(),0,'Redundant world homepage section removed');
  assert.equal(await page.locator('.nx-news-card').count(),3);assert.equal(await page.locator('#news').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(0, 0, 0)');const news=page.getByRole('button',{name:'โครงข่าว 1',exact:true});await news.hover();await news.click();assert.equal(await news.getAttribute('aria-pressed'),'true');await news.click();assert.equal(await news.getAttribute('aria-pressed'),'false');await page.locator('#news').screenshot({path:`artifacts/game-website/news-${width}.png`});
  for(const [label,id]of [['ข่าว','news'],['บทสอนต่อสู้','tutorials']]){await page.getByRole('link',{name:label,exact:true}).click();await page.waitForFunction(id=>Math.abs(document.getElementById(id).getBoundingClientRect().top)<80,id);assert.equal(await page.evaluate(()=>location.hash),'#'+id)}
  assert.equal(await page.locator('.nx-tutorial').count(),6);assert.equal(await page.locator('.nx-tutorial-pending').count(),6);assert.equal(await page.locator('.nx-tutorial-play').count(),0);
  await page.locator('#tutorials').screenshot({path:`artifacts/game-website/tutorials-${width}.png`});
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  await page.evaluate(()=>{sessionState={status:'authenticated',data:{user:{id:'test-account',name:'Test Player'}}};render()});
  await page.getByRole('button',{name:'บัญชี',exact:true}).click();
  await page.getByText('1,234',{exact:true}).waitFor();
  await page.evaluate(()=>Promise.all(document.getAnimations().map(animation=>animation.finished)));
  const drawer=await page.getByRole('dialog').boundingBox();assert.ok(Math.abs(drawer.x+drawer.width-width)<2&&drawer.y===0&&Math.abs(drawer.height-height)<2,'Account drawer anchored to right viewport edge');
  assert.equal(await page.getByRole('link',{name:'แก้ไขบัญชี'}).getAttribute('href'),'/game/account');
  await page.screenshot({path:`artifacts/game-website/account-${width}.png`});
  assert.equal(await page.getByRole('dialog').getByRole('link',{name:'เติม COIN'}).getAttribute('href'),'/game/topup');
  const rect=await page.getByRole('dialog').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width+1);
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.evaluate(()=>scrollTo(0,0));await page.mouse.move(width/2,height/2);await page.mouse.wheel(0,650);await page.waitForFunction(()=>scrollY>100);await page.mouse.wheel(0,-1500);await page.waitForFunction(()=>scrollY<5);
  await page.close();console.log(`${width}x${height}: images, layout, account, live wallet, COIN readiness and dialog passed`);
 }
 const page=await browser.newPage();await page.goto('http://localhost:3010/game');await page.getByRole('heading',{name:'NEXORA CARD GAME'}).waitFor();assert.equal(await page.locator('[data-game-platform]').count(),0);assert.equal(await page.locator('.nexora-game-back').count(),0);await page.getByRole('link',{name:'เข้าสู่ระบบ',exact:true}).click();await page.waitForURL('**/game/login?callbackUrl=%2Fgame');console.log('Live Next route: website without game patch gate/back button; login callback passed');
 const native=await browser.newPage();await native.addInitScript(()=>{window.nexoraDesktop={isGameDesktop:true,onUpdate:()=>()=>{},checkForUpdates:async()=>{},getVersion:async()=>'1.0.9'}});await native.goto('http://localhost:3010/game');await native.locator('[data-game-platform]').waitFor();assert.equal(await native.locator('.nexora-site').count(),0);console.log('Installed desktop: native shell retained, public website not rendered');
 }finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
