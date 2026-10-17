const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-settings-ui.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle='))+'return modules;')(require);
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
for(const [id,file]of [['gate','components/GamePatchGate.tsx'],['nav','components/GameLobbyNavigation.tsx'],['./GameFriendsPanel','components/GameFriendsPanel.tsx'],['overlay','components/GameProfileOverlay.tsx'],['./GameBackControl','components/GameBackControl.tsx'],['@/lib/game-profile-client','lib/game-profile-client.ts'],['@/lib/game-friends-client','lib/game-friends-client.ts'],['@/lib/game-profile-navigation','lib/game-profile-navigation.ts'],['./game-profile-options','lib/game-profile-options.ts']])modules[id]=transpile(fs.readFileSync(file,'utf8'));
// Share the same profile cache across relative and alias imports, as the app bundler does.
modules['./game-profile-client']="module.exports=require('@/lib/game-profile-client');";
for(const id of ['./GamePatchGate.css','./BattleLoadingScreen.css','./GameFriendsPanel.css','./GameProfileOverlay.css'])modules[id]='';
modules['@/lib/game-patcher']='';modules['@/lib/game-ui-audio']='exports.playGameUiSound=()=>{};';
modules['@/lib/lobby-assets']='exports.loadLobbyAssets=async()=>{};';
modules['next/navigation']='exports.usePathname=()=>"/game";';
modules['./OnlinePresenceProvider']='exports.useOnlinePresence=()=>({isOnline:()=>false});';
modules['next-auth/react']='exports.useSession=()=>({status:"authenticated",data:{user:{id:"self",name:"Me",image:"/avatar.png"}}});';
modules['./GamePlayerProfile']='exports.__esModule=true;exports.default=p=>require("react").createElement("main",{"data-player":p.user.id},p.user.name+" "+p.rank.name);';
const script=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}window.active=false;window.requests=[];window.fetch=url=>new Promise(resolve=>requests.push({url,resolve}));window.finish=(url,data)=>requests.find(r=>r.url===url).resolve({ok:true,json:async()=>data});window.profile=id=>({user:{id,name:id==='friend-1'?'Alpha':id==='friend-2'?'Beta':'Me',image:'/avatar.png'},appearance:{avatar:'',frame:'gold',hero:'gold'},available:true,stats:{wins:2,losses:1},rank:{name:'Bronze',nextWins:10,nextName:'Silver'}});window.homeToken=Math.random();const R=require('react');function App(){return R.createElement('div',{className:'nexora-game-platform'},R.createElement(require('gate').default,null,R.createElement('div',{id:'home-token'},homeToken),R.createElement(require('nav').default,{onRank:()=>{},onHome:()=>{},onJoin:()=>{}})),R.createElement(require('overlay').default))}require('react-dom/client').createRoot(document.getElementById('root')).render(R.createElement(App));`;
const frame=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{for(const viewport of [{width:1440,height:900},{width:844,height:390},{width:390,height:844}]){
 const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const css=['GameFriendsPanel.css','GameProfileOverlay.css','GameShell.css'].map(file=>fs.readFileSync('components/'+file,'utf8')).join('\n');
 await page.route('http://social.test/**',route=>route.request().resourceType()==='image'?route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhZkAAAAASUVORK5CYII=','base64')}):route.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><style>${css}</style><div id="root"></div><script>${script}</script>`}));
 await page.goto('http://social.test/');await page.waitForFunction(()=>requests.some(r=>r.url==='/api/community/friends'));
 await page.evaluate(()=>finish('/api/community/friends',{friends:[{id:'relation-1',friendId:'friend-1',displayName:'Alpha',image:'/avatar.png'},{id:'relation-2',friendId:'friend-2',displayName:'Beta',image:'/avatar.png'}],requests:[]}));
 await page.waitForFunction(()=>requests.some(r=>r.url.endsWith('id=friend-2')));
 await page.evaluate(()=>{for(const id of ['self','friend-1','friend-2'])finish('/api/game-profile/details?id='+id,profile(id))});
 const friendsButton=page.getByRole('button',{name:'เพื่อน',exact:true});await friendsButton.waitFor();const token=await page.locator('#home-token').textContent(),url=page.url();
 await page.evaluate(()=>{const now=Date.now;Date.now=()=>now()+60000;[...document.querySelectorAll('button')].find(b=>b.title==='เพื่อน').click()});await frame(page);
 assert.equal(await page.locator('.gf-player').count(),2,'Cached friend list renders within two frames while refresh stalls');assert.equal(await page.getByText('กำลังเชื่อมต่อ...').count(),0);
 for(const name of ['Alpha','Beta']){
  await page.getByRole('button',{name:'เปิดโปรไฟล์ '+name,exact:true}).click();await frame(page);
  assert.equal(await page.locator('main').textContent(),name+' Bronze');assert.equal(page.url(),url);
  await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'โปรไฟล์เกม'}).waitFor({state:'detached'});
  assert.equal(await page.locator('.gf-player').count(),2);assert.equal(await page.locator('#home-token').textContent(),token);assert.equal(await page.locator('.nexora-game-loading').count(),0,'Back never restarts the entry loader');
 }
 await page.getByRole('button',{name:'ปิดหน้าเพื่อน'}).click();
 await page.evaluate(()=>require('@/lib/game-profile-navigation').openGameProfile('friend-1'));await frame(page);assert.equal(await page.locator('main').textContent(),'Alpha Bronze');
 await page.getByRole('button',{name:'ย้อนกลับ',exact:true}).click();await page.getByRole('dialog',{name:'โปรไฟล์เกม'}).waitFor({state:'detached'});assert.equal(await page.locator('#home-token').textContent(),token);assert.equal(await page.locator('.nexora-game-loading').count(),0);
 await page.reload();await friendsButton.waitFor();assert.equal(await page.locator('.nexora-game-loading').count(),0,'A prepared return does not show a download screen');assert.deepEqual(errors,[]);
 console.log(`Social ${viewport.width}x${viewport.height}: prefetched list, both friend profiles, chat event, state-preserving back and prepared return passed`);await page.close();
}}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
