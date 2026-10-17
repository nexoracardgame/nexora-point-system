const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-settings-ui.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle='))+'return modules;')(require);
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
for(const [id,file]of [['profile','components/GamePlayerProfile.tsx'],['./GamePageLogo','components/GamePageLogo.tsx'],['@/lib/game-profile-options','lib/game-profile-options.ts']])modules[id]=transpile(fs.readFileSync(file,'utf8'));
for(const id of ['./GamePlayerProfile.css','./GameProfileFrame.css','./GamePageLogo.css'])modules[id]='';
modules['@/lib/game-profile-client']='exports.updateCachedGameAppearance=()=>{};';
modules['next/link']='exports.__esModule=true;exports.default=p=>require("react").createElement("a",p,p.children);';
const script=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}require('react-dom/client').createRoot(document.getElementById('root')).render(require('react').createElement(require('profile').default,{user:{id:'test',name:'NEXORA Official',image:'/avatar.png'},initial:{avatar:'',frame:'gold',hero:'gold'},available:true,stats:{wins:2,losses:1},rank:{name:'Bronze',nextWins:10,nextName:'Silver'}}));`;
const css=['BattleHud.css','GameShell.css','GamePlayerProfile.css','GameProfileFrame.css','GamePageLogo.css','GameWindowControls.css'].map(name=>fs.readFileSync('components/'+name,'utf8')).join('\n');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});fs.mkdirSync('artifacts/profile-logo-beside-back',{recursive:true});try{
 for(const [width,height]of [[3840,2160],[1920,1080],[1366,768],[844,390],[667,375],[390,844],[320,568]])for(const desktop of [false,true]){
  const page=await browser.newPage({viewport:{width,height}});
  await page.route('http://logo.test/**',route=>{const url=new URL(route.request().url());if(url.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><style>body{margin:0}${css}#root{position:absolute;inset:0}</style><div class="nexora-game-platform"><button class="nexora-game-back"><img src="/images/lobby-play/back-button.png" alt="ย้อนกลับ"></button>${desktop?'<div class="nexora-window-controls"><button>-</button><button>+</button><button>x</button></div>':''}<div id="root"></div></div><script>${desktop?'document.documentElement.dataset.gameWindowControls="desktop";':''}${script}</script>`});return route.fulfill({body:fs.readFileSync(path.join('public',url.pathname)),contentType:url.pathname.endsWith('.png')?'image/png':'image/webp'})});
  await page.goto('http://logo.test/');await page.locator('.gpp-framed-identity').waitFor();await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0));
  const back=await page.locator('.nexora-game-back').boundingBox(),logo=await page.locator('.nexora-page-logo').boundingBox(),header=await page.locator('.gpp-header').boundingBox();
  assert.ok(Math.abs(logo.x-back.x-back.width-10)<1,'10px gap beside back');assert.ok(Math.abs(logo.y+logo.height/2-back.y-back.height/2)<1,'Vertical alignment');assert.ok(logo.y+logo.height<=header.y+header.height+1,'Header contains logo');assert.ok(logo.width>40&&logo.x+logo.width<=width,'Logo stays visible and in bounds');
  if(desktop){const controls=await page.locator('.nexora-window-controls').boundingBox();assert.ok(logo.x+logo.width<=controls.x,'No window control overlap')}
  if(!desktop||width===320)await page.screenshot({path:`artifacts/profile-logo-beside-back/${width}-${desktop?'pc':'web'}.png`});
  console.log(`Logo/back aligned ${width}x${height}, ${desktop?'desktop controls':'web/mobile'}`);await page.close();
 }
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
