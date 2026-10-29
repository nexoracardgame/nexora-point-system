const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-monsters.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle='))+'return modules;')(require);
modules['next-auth/react']="exports.useSession=()=>({data:{user:{id:'b'}},status:'authenticated'});";
modules['next/navigation']="exports.useRouter=()=>({push:path=>window.destination=path});";
modules['@/lib/supabase-browser']='exports.getBrowserSupabaseClient=()=>null;';
modules['@/lib/game-friends-client']="exports.gameFriendId=f=>f.id;exports.loadGameFriends=async()=>({friends:[{id:'a',displayName:'A LONG FRIEND NAME',image:'/avatar.png'},{id:'c',displayName:'Another Friend',image:'/avatar.png'}]});";
modules['./GameInvitations.css']='';
modules.ui=ts.transpileModule(fs.readFileSync('components/GameInvitations.tsx','utf8'),{fileName:'ui.tsx',compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
const bundle=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}require('react-dom/client').createRoot(document.getElementById('root')).render(require('react').createElement(require('ui').default));`;
const invite={id:'incoming',fromId:'a',toId:'b',senderName:'NEXORA FRIEND',senderImage:'/avatar.png',mode:'heptad',code:'123456',expiresAt:Date.now()+120000};
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 fs.mkdirSync('artifacts/game-invitations',{recursive:true});
 for(const [width,height]of [[3840,2160],[1920,1080],[844,390],[667,375]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];let sends=0,accepts=0,declines=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://invite.test/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/game-invitations'){
    if(route.request().method()==='POST'){
     const body=route.request().postDataJSON();if(body.action==='invite'){sends++;await new Promise(r=>setTimeout(r,50));return route.fulfill({json:{invitation:{id:'sent'}}});}
     if(body.action==='accept'){accepts++;return route.fulfill({json:{room:{mode:'heptad',code:'123456'}}});}
     declines++;return route.fulfill({json:{room:null}});
    }
    return route.fulfill({json:{invitations:url.searchParams.has('mode')?[]:[invite]}});
   }
   if(url.pathname==='/avatar.png'||url.pathname==='/images/versus/arena.png')return route.fulfill({path:'public'+url.pathname});
   return route.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><style>body{margin:0;background:#101b20}${fs.readFileSync('components/GameInvitations.css','utf8')}</style><div id="root"></div><script>${bundle.replaceAll('</script','<\\/script')}</script>`});
  });
  await page.goto('http://invite.test/');await page.locator('.game-invite-toast').waitFor();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('nexora:invite-friends',{detail:{mode:'heptad',code:'123456'}})));
  await page.getByText('A LONG FRIEND NAME',{exact:true}).waitFor();
  const box=await page.locator('.game-invite-window').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);
  assert.equal(await page.locator('.game-invite-overlay').evaluate(n=>getComputedStyle(n).backdropFilter),'blur(12px)');
  const first=page.locator('.game-invite-list article').first().getByRole('button');await first.dblclick({delay:10});await page.getByRole('button',{name:'เชิญแล้ว',exact:true}).waitFor();assert.equal(sends,1);assert.equal(await first.isDisabled(),true);
  await page.screenshot({path:`artifacts/game-invitations/${width}.png`});
  await page.getByRole('button',{name:'ปิดหน้าต่างเชิญเพื่อน'}).click();
  await page.getByRole('button',{name:'ยอมรับ',exact:true}).click();await page.waitForFunction(()=>window.destination==='/game/heptad?room=123456');assert.equal(accepts,1);assert.equal(declines,0);assert.deepEqual(errors,[]);
  await page.close();console.log(`${width}x${height}: centered blurred invitation, disabled duplicate, recipient toast and accepted navigation passed`);
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
