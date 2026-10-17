const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-settings-ui.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle='))+'return modules;')(require);
modules.website=ts.transpileModule(fs.readFileSync('components/GameWebsite.tsx','utf8'),{compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
modules['./GameWebsite.css']='';
modules['next-auth/react']="exports.useSession=()=>window.sessionState;exports.signOut=async()=>{window.signedOut=true}";
modules['next/link']="module.exports={__esModule:true,default:props=>require('react').createElement('a',props)}";
const script=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}window.sessionState={status:'unauthenticated',data:null};const root=require('react-dom/client').createRoot(document.getElementById('root'));window.render=()=>root.render(require('react').createElement(require('website').default));render();`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 fs.mkdirSync('artifacts/game-website',{recursive:true});
 for(const [width,height]of [[1920,1080],[1366,768],[844,390],[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height}});
  await page.route('http://website.test/**',async route=>{const pathname=new URL(route.request().url()).pathname;if(pathname.startsWith('/images/'))return route.fulfill({body:fs.readFileSync('public'+pathname),contentType:'image/webp'});if(pathname==='/api/game-wallet')return route.fulfill({json:{coin:1234,nexPoint:5678}});return route.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><style>body{margin:0}${fs.readFileSync('components/GameWebsite.css','utf8')}</style><div id="root"></div><script>${script}</script>`})});
  await page.goto('http://website.test/');await page.getByRole('heading',{name:'NEXORA CARD GAME'}).waitFor();
  await page.waitForFunction(()=>Array.from(document.images).every(image=>image.complete&&image.naturalWidth>0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow');
  await page.evaluate(()=>Promise.all(document.getAnimations().map(animation=>animation.finished)));
  await page.screenshot({path:`artifacts/game-website/${width}.png`,fullPage:true});
  await page.evaluate(()=>{sessionState={status:'authenticated',data:{user:{id:'test-account',name:'Test Player'}}};render()});
  await page.getByRole('button',{name:'บัญชี',exact:true}).click();
  await page.getByText('1,234',{exact:true}).waitFor();
  await page.getByRole('dialog').getByRole('button',{name:'เติม COIN'}).click();
  await page.getByText('ระบบเติมเงินยังไม่เปิดให้บริการ ไม่มีการรับชำระเงินในขณะนี้').waitFor();
  const rect=await page.getByRole('dialog').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width+1);
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.close();console.log(`${width}x${height}: images, layout, account, live wallet, COIN readiness and dialog passed`);
 }
 const page=await browser.newPage();await page.goto('http://localhost:3010/game');await page.getByRole('heading',{name:'NEXORA CARD GAME'}).waitFor();assert.equal(await page.locator('[data-game-platform]').count(),0);assert.equal(await page.locator('.nexora-game-back').count(),0);await page.getByRole('link',{name:'เข้าสู่ระบบ',exact:true}).click();await page.waitForURL('**/game/login?callbackUrl=%2Fgame');console.log('Live Next route: website without game patch gate/back button; login callback passed');
 const native=await browser.newPage();await native.addInitScript(()=>{window.nexoraDesktop={isGameDesktop:true,onUpdate:()=>()=>{},checkForUpdates:async()=>{},getVersion:async()=>'1.0.9'}});await native.goto('http://localhost:3010/game');await native.locator('[data-game-platform]').waitFor();assert.equal(await native.locator('.nexora-site').count(),0);console.log('Installed desktop: native shell retained, public website not rendered');
 }finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
