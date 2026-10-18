const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-monsters.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle='))+'return modules;')(require);
modules.guard=ts.transpileModule(fs.readFileSync('components/GameLandscapeGuard.tsx','utf8'),{compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
modules['./GameLandscapeGuard.css']='';
const bundle=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}require('react-dom/client').createRoot(document.getElementById('root')).render(require('react').createElement(require('guard').default));`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 fs.mkdirSync('artifacts/game-landscape',{recursive:true});
 for(const [width,height] of [[390,844],[320,568],[768,1024],[1200,1600]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://landscape.test/**',route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/images/'))return route.fulfill({path:'public'+path});return route.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><style>body{margin:0}${fs.readFileSync('components/GameLandscapeGuard.css','utf8')}</style><div id="root"></div><script>${bundle}</script>`})});
  await page.goto('http://landscape.test/');await page.waitForTimeout(80);assert.equal(await page.locator('.game-landscape-guard').count(),0,'Public website is unaffected');
  await page.evaluate(()=>{window.hits=0;document.addEventListener('keydown',()=>window.hits++);document.documentElement.requestFullscreen=async()=>{window.fullscreenAttempt=true;throw Error('Unavailable')};const node=document.createElement('div');node.dataset.gamePlatform='';node.innerHTML='<button id="underlying">Game</button><dialog id="seal"><button>Seal</button></dialog>';document.body.append(node);document.getElementById('seal').showModal()});
  const guard=page.getByRole('dialog',{name:'เล่นเกมในแนวนอน'});await guard.waitFor();assert.equal(await guard.evaluate(node=>node.matches(':modal')),true);
  const rect=await guard.boundingBox();assert.deepEqual([rect.x,rect.y,rect.width,rect.height],[0,0,width,height]);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.hits),0,'Escape cannot close underlying game overlays');assert.equal(await guard.isVisible(),true);
  await guard.getByRole('button').click();assert.equal(await page.evaluate(()=>window.fullscreenAttempt),true);assert.equal(await guard.isVisible(),true,'Refused fullscreen keeps the rotation gate');
  assert.equal(await guard.getByRole('button').evaluate(node=>{const r=node.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===node||node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),true,'Gate stays above an existing native seal dialog');
  await page.screenshot({path:`artifacts/game-landscape/portrait-${width}.png`});
  await page.setViewportSize({width:height,height:width});await guard.waitFor({state:'detached'});assert.equal(await page.locator('#seal').evaluate(node=>node.open),true,'Rotation does not reset the game');
  await page.setViewportSize({width,height});await guard.waitFor();await page.evaluate(()=>document.querySelector('[data-game-platform]').remove());await guard.waitFor({state:'detached'});
  for(const scene of ['nexora-battle-shell','nexora-pentad-shell','nexora-web-login']){await page.evaluate(name=>{const node=document.createElement('main');node.className=name;document.body.append(node)},scene);await guard.waitFor();await page.evaluate(name=>document.querySelector('.'+name).remove(),scene);await guard.waitFor({state:'detached'})}
  assert.deepEqual(errors,[]);await page.close();console.log(`${width}x${height}: all game surfaces gated, website unaffected, modal/focus/fullscreen fallback and rotation recovery passed`);
 }
 const manifest=fs.readFileSync('android/app/src/main/AndroidManifest.xml','utf8'),plist=fs.readFileSync('ios/App/App/Info.plist','utf8');assert.ok(manifest.includes('screenOrientation="sensorLandscape"'));assert.ok(!plist.includes('UIInterfaceOrientationPortrait'));assert.ok(fs.readFileSync('app/game/manifest.webmanifest/route.ts','utf8').includes('orientation: "landscape"'));
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
