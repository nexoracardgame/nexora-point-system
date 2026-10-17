const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { chromium } = require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const transpile = code => ts.transpileModule(code, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const modules = {};
for (const [id,pkg,file] of [['react','react','react.production.js'],['react/jsx-runtime','react','react-jsx-runtime.production.js'],['react-dom','react-dom','react-dom.production.js'],['react-dom/client','react-dom','react-dom-client.production.js'],['scheduler','scheduler','scheduler.production.js']]) {
  modules[id] = fs.readFileSync(path.join(path.dirname(require.resolve(pkg)),'cjs',file),'utf8');
}
modules['lucide-react'] = fs.readFileSync(require.resolve('lucide-react'),'utf8');
modules['next-auth/react'] = `exports.useSession=()=>({status:window.guest?'unauthenticated':'authenticated',data:{user:{id:'self',name:'NOC Official',image:'/avatar.png'}}});`;
modules['./OnlinePresenceProvider'] = `exports.useOnlinePresence=()=>({isOnline:id=>id==='player-01'});`;
modules['@/lib/game-ui-audio'] = 'exports.playGameUiSound=()=>{};';
modules['./GameFriendsPanel.css'] = '';
modules['@/lib/game-profile-client']='exports.warmGameProfile=async()=>{};';
modules['./game-profile-client']=modules['@/lib/game-profile-client'];
modules['@/lib/game-friends-client']=transpile(fs.readFileSync('lib/game-friends-client.ts','utf8'));
modules['@/lib/game-profile-navigation']=transpile(fs.readFileSync('lib/game-profile-navigation.ts','utf8'));
modules['./GameFriendsPanel'] = transpile(fs.readFileSync('components/GameFriendsPanel.tsx','utf8'));
modules['./GameCardCollection']='exports.__esModule=true;exports.default=()=>null;';
modules.nav = transpile(fs.readFileSync('components/GameLobbyNavigation.tsx','utf8'));
const bundle = Object.entries(modules).map(([id,code])=>`${JSON.stringify(id)}:function(require,module,exports){${code}\n}`).join(',');
const css = ['components/GameFriendsPanel.css','components/LobbyActionButton.css'].map(p=>fs.readFileSync(p,'utf8')).join('\n');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}body{margin:0;background:#111}.nexora-command-nav{padding:30px}.nexora-play-viewport-control{position:fixed;right:0;bottom:100px}</style></head><body><div id="root"></div><button class="nexora-play-viewport-control">PLAY</button><script>
const modules={${bundle}},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](require,m,m.exports);return m.exports;}
window.chatEvents=[];addEventListener('nexora:open-floating-chat',e=>{chatEvents.push(e.detail);document.documentElement.dataset.floatingChatOpen='true'});
const root=require('react-dom/client').createRoot(document.getElementById('root'));root.render(require('react').createElement(require('nav').default,{onRank:()=>{},onHome:()=>{},onJoin:()=>{}}));
</script></body></html>`;

// The same search scorer serves the game and the app, including canonical IDs.
const source = fs.readFileSync('lib/friend-store.ts','utf8');
const ast = ts.createSourceFile('store.ts',source,ts.ScriptTarget.Latest,true);
const functions = ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&['normalizeSearchValue','scoreCommunityCandidate'].includes(n.name?.text)).map(n=>n.getText(ast)).join('\n');
const score = new Function(transpile(functions)+';return scoreCommunityCandidate;')();
const candidate = {id:'player-012345',displayName:'NOC Player',username:'champion',bio:''};
assert.equal(score(candidate,'player-012345'),110);
assert.equal(score(candidate,'012345'),72);
assert.equal(score(candidate,'champion'),100);
assert.equal(score(candidate,'missing'),0);
assert.match(fs.readFileSync('components/FloatingChatDock.tsx','utf8'),/data-floating-chat-open/);

(async()=>{
  const browser = await chromium.launch({channel:'chrome',headless:true});
  fs.mkdirSync('artifacts/game-friends',{recursive:true});
  try {
    const page = await browser.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    let friends,requests,posts,failed=false;
    const reset=()=>{
      friends=[{id:'link-1',friendId:'player-01',displayName:'S1R 3AZ',username:'s1r3az',image:'/avatar.png'},{id:'link-2',friendId:'player-02',displayName:'ชื่อผู้เล่นที่ยาวมากสำหรับทดสอบการแสดงผลบนมือถือ',username:'nexora_champion',image:'/avatar.png'}];
      requests=[{id:'request-1',fromUserId:'player-03',displayName:'Margarita',username:'margarita',image:'/avatar.png'}];posts=[];
    };
    reset();
    await page.route('https://friends.test/**',async route=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/')return route.fulfill({body:html,contentType:'text/html'});
      if(url.pathname==='/api/community/friends'){
        if(failed)return route.fulfill({status:503,json:{error:'unavailable'}});
        if(route.request().method()==='GET')return route.fulfill({json:{friends,requests}});
        const data=route.request().postDataJSON();posts.push(data);
        if(data.action==='respond'){requests=[];if(data.decision==='accept')friends.push({id:'link-3',friendId:'player-03',displayName:'Margarita',username:'margarita',image:'/avatar.png'});}
        if(data.action==='remove')friends=friends.filter(p=>p.friendId!==data.targetUserId);
        return route.fulfill({json:{friends,requests,relation:{status:'outgoing',requestId:'sent-1'}}});
      }
      if(url.pathname==='/api/community/search'){
        const q=url.searchParams.get('q');
        return route.fulfill({json:{users:q==='nobody'?[]:[{id:'player-04',displayName:'Dragon Knight',username:'dragon',image:'/avatar.png',relation:'none'}]}});
      }
      const asset=path.resolve('public','.'+url.pathname);
      if(!asset.startsWith(path.resolve('public')+path.sep)||!fs.existsSync(asset))return route.abort();
      return route.fulfill({body:fs.readFileSync(asset),contentType:asset.endsWith('.webp')?'image/webp':'image/png'});
    });
    const open=async()=>{await page.getByRole('button',{name:'เพื่อน',exact:true}).click();await page.getByRole('heading',{name:'รายชื่อเพื่อน',exact:true}).waitFor();await page.locator('.gf-player').first().waitFor();};
    for(const [width,height] of [[1440,900],[1920,1080],[390,844],[320,568],[844,390]]){
      await page.setViewportSize({width,height});await page.goto('https://friends.test/');await open();
      assert.equal(await page.locator('.nexora-play-viewport-control').isVisible(),false,'PLAY hidden while friends open');
      await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
      for(const selector of ['.gf-shell','.gf-header','.gf-toolbar','.gf-actions']){
        const rects=await page.locator(selector).evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
        for(const r of rects)assert.ok(r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1,`${selector} fits ${width}x${height}: ${JSON.stringify(r)}`);
      }
      await page.screenshot({path:`artifacts/game-friends/friends-${width}.png`});
      await page.keyboard.press('Escape');assert.equal(await page.locator('.gf-shell').count(),0);
      assert.equal(await page.locator('.nexora-play-viewport-control').isVisible(),true);
    }
    await page.setViewportSize({width:1440,height:900});await page.goto('https://friends.test/');await open();
    await page.getByRole('button',{name:/คำขอเป็นเพื่อน/}).click();await page.getByTitle('รับเป็นเพื่อน',{exact:true}).click();
    await page.getByRole('status').filter({hasText:'รับเป็นเพื่อนแล้ว'}).waitFor();
    assert.deepEqual(posts.at(-1),{action:'respond',requestId:'request-1',decision:'accept'});
    await page.getByRole('button',{name:/เพื่อนทั้งหมด/}).click();await page.getByRole('heading',{name:'Margarita',exact:true}).waitFor();
    await page.getByRole('button',{name:/ค้นหาผู้เล่น/,exact:true}).click();
    await page.getByRole('textbox').fill('player-04');await page.getByRole('heading',{name:'Dragon Knight'}).waitFor();
    await page.getByRole('button',{name:'เพิ่มเพื่อน',exact:true}).click();await page.getByText('รอตอบรับ').waitFor();
    assert.deepEqual(posts.at(-1),{action:'request',targetUserId:'player-04'});
    await page.screenshot({path:'artifacts/game-friends/search.png'});
    await page.getByRole('textbox').fill('nobody');await page.getByRole('heading',{name:'ไม่พบผู้เล่น'}).waitFor();
    await page.getByRole('button',{name:/เพื่อนทั้งหมด/}).click();
    await page.getByRole('button',{name:'ลบเพื่อน S1R 3AZ'}).click();await page.getByRole('button',{name:'ยืนยัน',exact:true}).click();
    await page.getByRole('status').filter({hasText:'ลบเพื่อนแล้ว'}).waitFor();assert.equal(friends.some(p=>p.friendId==='player-01'),false);
    await page.locator('.gf-player').filter({hasText:'Margarita'}).getByTitle('ส่งข้อความ',{exact:true}).click();
    assert.equal(await page.locator('.gf-shell').count(),0);
    assert.equal(await page.evaluate(()=>chatEvents[0].userId),'player-03');
    assert.equal(await page.locator('.nexora-play-viewport-control').isVisible(),false,'PLAY stays hidden when shared chat opens');
    await page.evaluate(()=>document.documentElement.removeAttribute('data-floating-chat-open'));
    failed=true;await page.getByRole('button',{name:'เพื่อน',exact:true}).click();await page.getByRole('button',{name:'โหลดรายชื่อใหม่'}).click();await page.getByRole('alert').waitFor();
    failed=false;await page.getByRole('button',{name:'โหลดรายชื่อใหม่'}).click();await page.locator('.gf-player').first().waitFor();
    await page.keyboard.press('Escape');await page.evaluate(()=>window.guest=true);await page.getByRole('button',{name:'เพื่อน',exact:true}).click();
    await page.getByRole('heading',{name:'เข้าสู่ระบบเพื่อดูเพื่อน'}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS: ID/name scoring, responsive layouts/assets, requests, add/remove, search/empty/error/guest, shared chat event and PLAY visibility. API writes mocked; no real users contacted.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
