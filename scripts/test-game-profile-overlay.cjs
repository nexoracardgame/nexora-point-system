const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-settings-ui.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle='))+'return modules;')(require);
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
modules.overlay=transpile(fs.readFileSync('components/GameProfileOverlay.tsx','utf8'));modules['./GameProfileOverlay.css']='';
modules.overlay+=";document.querySelector('#own').style.cssText='position:relative;z-index:1';";
modules['next-auth/react']='exports.useSession=()=>({data:{user:{id:"self",name:"My profile",image:"/avatar.png"}},status:"authenticated"});';
modules['@/lib/game-profile-client']=transpile(fs.readFileSync('lib/game-profile-client.ts','utf8'));
modules['@/lib/game-profile-options']='exports.defaultGameAppearance={avatar:"",frame:"gold",hero:"gold"};';
modules['./GameBackControl']=transpile(fs.readFileSync('components/GameBackControl.tsx','utf8'));modules['@/lib/game-ui-audio']='exports.playGameUiSound=()=>{};';
modules['./GamePlayerProfile']='exports.__esModule=true;exports.default=p=>require("react").createElement("main",{"data-user":p.user.id,"data-readonly":p.readOnly,"data-pending":p.pending},p.user.name);';
const script=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}window.path='/game';window.requests=[];window.fetch=url=>new Promise(resolve=>requests.push({url,resolve}));require('@/lib/game-profile-client').primeGameIdentity('friend','Friend name','/avatar.png');const React=require('react');require('react-dom/client').createRoot(document.getElementById('root')).render(React.createElement(require('overlay').default));`;
async function resolveProfile(page,id,name){await page.waitForFunction(id=>requests.some(r=>r.url.includes('id='+id)),id);await page.evaluate(({id,name})=>{const data={user:{id,name,image:'/avatar.png'},appearance:{avatar:'',frame:'gold',hero:'gold'},available:true,stats:{wins:1,losses:0},rank:{name:'Bronze',nextWins:null,nextName:null}};requests.find(r=>r.url.includes('id='+id)).resolve({ok:true,json:async()=>data})},{id,name});}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const [width,height]of [[1920,1080],[844,390],[390,844]]){
  const page=await browser.newPage({viewport:{width,height}});
  await page.route('http://overlay.test/**',r=>r.fulfill({contentType:'text/html',body:`<style>body{margin:0}#root{position:absolute;inset:0}${fs.readFileSync('components/GameProfileOverlay.css','utf8')}${fs.readFileSync('components/GameShell.css','utf8')}</style><a id="own" href="/game/profile">Own profile</a><div id="root"></div><script>${script}</script>`}));
  await page.goto('http://overlay.test/');
  await page.waitForFunction(()=>requests.some(r=>r.url.includes('id=self')));
  const initial=page.url();await page.locator('#own').click({force:true});
  await page.waitForTimeout(80);
  assert.equal(await page.getByRole('dialog').count(),0,'No placeholder while uncached request is stalled');
  await resolveProfile(page,'self','My real profile');
  await page.getByText('My real profile',{exact:true}).waitFor();
  assert.equal(await page.locator('main').getAttribute('data-readonly'),'false');
  await page.getByRole('button',{name:'ย้อนกลับ',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('nexora:open-game-profile',{detail:{id:'friend'}})));
  await page.waitForTimeout(80);assert.equal(await page.getByRole('dialog').count(),0,'Identity-only cache must not display an incomplete profile');
  await resolveProfile(page,'friend','Loaded friend');await page.getByText('Loaded friend',{exact:true}).waitFor();
  assert.equal(await page.locator('main').getAttribute('data-readonly'),'true');
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
  const count=await page.evaluate(()=>requests.length);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('nexora:open-game-profile',{detail:{id:'friend'}})));
  await page.getByText('Loaded friend',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>requests.length),count,'Cached reopen needs no request');
  assert.equal(page.url(),initial);assert.equal(await page.locator('.nexora-game-loading').count(),0);
  assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('nexora:profile:friend')).value.user.name),'Loaded friend');
  console.log(`Profile ${width}x${height}: complete data only, prefetch, cached reopen, persisted cache and back/Escape passed`);await page.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
