const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-monsters.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle='))+'return modules;')(require);
const transpile=file=>{const result=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}});assert.equal(result.diagnostics?.length||0,0,`${file}: no syntax errors`);return result.outputText};
modules['./BattlePlayerProfile']=transpile('components/BattlePlayerProfile.tsx');
modules['./BattlePlayerProfile.css']='';
modules['./BattleCardGeometry.css']='';
modules['@/lib/game-profile-client']=transpile('lib/game-profile-client.ts');
modules['./game-profile-options']='exports.gameHeroes=[]';
modules.hud=transpile('components/BattleArenaHud.tsx');
const bundle=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;if(!Object.hasOwn(modules,id))throw Error('Missing '+id);const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}const React=require('react'),Plate=require('hud').BattleArenaScoreplate;require('react-dom/client').createRoot(document.getElementById('root')).render(React.createElement('main',{className:'arena'},...['enemy','own','bot'].map((id,i)=>React.createElement(Plate,{key:id,name:id,score:7,player:i===1,avatar:null,currentUserId:'own',identity:{id:id==='bot'?'triad-bot-level-99':id,name:id==='bot'?'BOT Level.99':id==='own'?'PLAYER':'OPPONENT LONG PLAYER NAME',image:'/avatar.png'},rank:{rankName:'Gold',wins:12,losses:4}}))));`;
const css=fs.readFileSync('components/BattleHud.css','utf8')+'\n'+fs.readFileSync('components/BattlePlayerProfile.css','utf8');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 fs.mkdirSync('artifacts/battle-player-profile',{recursive:true});
 for(const [width,height] of [[3840,2160],[3440,1440],[2560,1440],[1920,1080],[1280,720],[844,390],[667,375],[568,320]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];let relation='none',posts=0,statusFail=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://battle-profile.test/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/game-profile/details')return route.fulfill({json:{user:{id:url.searchParams.get('id'),name:'LIVE PLAYER',image:'/avatar.png'},appearance:{avatar:'/avatar.png',hero:'gold',frame:'gold'},available:true,stats:{wins:32,losses:8},rank:{name:'Diamond',nextWins:50,nextName:'Master'}}});
   if(url.pathname.startsWith('/api/community/status/'))return route.fulfill({status:statusFail?503:200,json:statusFail?{error:'offline'}:{relation:{status:relation,requestId:relation==='incoming'?'request-1':null}}});
   if(url.pathname==='/api/community/friends'){posts++;const payload=route.request().postDataJSON();assert.ok(payload.targetUserId==='enemy'||payload.requestId==='request-1');await new Promise(r=>setTimeout(r,100));relation=payload.action==='respond'?'friends':'outgoing';return route.fulfill({json:{relation:{status:relation}}})}
   if(url.pathname.startsWith('/images/')||url.pathname==='/avatar.png')return route.fulfill({path:'public'+url.pathname});
   return route.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><style>body{margin:0;background:#172b34}*{box-sizing:border-box}${css}.arena{position:relative;height:100vh}.nexora-arena-scoreplate:nth-child(3){top:45vh}</style><div id="root"></div><script>${bundle}</script>`});
  });
  await page.goto('http://battle-profile.test/');
  const left=page.getByRole('button',{name:'ดูโปรไฟล์ OPPONENT LONG PLAYER NAME'}),right=page.getByRole('button',{name:'ดูโปรไฟล์ PLAYER',exact:true});
  await left.waitFor();await left.locator('.bpi-rank').filter({hasText:'Diamond'}).waitFor();
  assert.equal(await right.locator('.bpi-name-frame').evaluate(n=>getComputedStyle(n).transform),'matrix(-1, 0, 0, 1, 0, 0)');
  const a=await left.boundingBox(),b=await right.boundingBox();assert.ok(a.x+a.width<b.x,'Mirrored identities do not overlap');
  if(width===3840)assert.ok(a.width>=600,'4K profile frame is enlarged');
  await page.screenshot({path:`artifacts/battle-player-profile/frames-${width}.png`});
  await left.click();const dialog=page.getByRole('dialog');await dialog.waitFor();
  await page.getByRole('heading',{name:'LIVE PLAYER'}).waitFor();assert.match(await dialog.innerText(),/32[\s\S]*8[\s\S]*80%/);
  assert.ok(!(await dialog.innerText()).includes('กำลังโหลดแรงค์'));assert.ok(!(await dialog.innerText()).includes('โหลดโปรไฟล์ไม่สำเร็จ'));
  assert.equal(await dialog.getAttribute('aria-modal'),'false');
  assert.equal(await dialog.evaluate(n=>getComputedStyle(n,'::before').animationName),'bpp-aura');
  assert.equal(await dialog.evaluate(n=>n.matches(':modal')),false);
  assert.equal(await left.evaluate(n=>getComputedStyle(n.closest('.nexora-arena-scoreplate')).backgroundColor),'rgba(0, 0, 0, 0)');
  assert.equal(await left.evaluate(n=>getComputedStyle(n.closest('.nexora-arena-scoreplate')).backdropFilter),'none');
  const r=await dialog.boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height,'Mini profile fits landscape viewport');
  assert.ok(Math.abs(r.x-a.x)<16,'Mini profile stays at the clicked frame, not screen center');
  await page.getByRole('button',{name:'เพิ่มเพื่อน',exact:true}).click();
  await page.getByText('ส่งคำขอแล้ว',{exact:true}).waitFor();assert.equal(posts,1);
  await page.screenshot({path:`artifacts/battle-player-profile/${width}.png`});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.ok(await left.evaluate(n=>n===document.activeElement));
  relation='friends';await left.click();await page.getByText('เป็นเพื่อนแล้ว',{exact:true}).waitFor();await page.getByRole('button',{name:'ปิดโปรไฟล์'}).click();
  relation='incoming';await left.click();await page.getByRole('button',{name:'รับเป็นเพื่อน'}).click();await page.getByText('เป็นเพื่อนแล้ว',{exact:true}).waitFor();assert.equal(posts,2);await page.keyboard.press('Escape');
  statusFail=true;await left.click();await page.getByRole('button',{name:'ลองใหม่',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'เพิ่มเพื่อน',exact:true}).count(),0);await page.keyboard.press('Escape');
  await right.click();await page.getByRole('heading',{name:'LIVE PLAYER'}).waitFor();assert.equal(await page.locator('.bpp-friend').count(),0);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'ดูโปรไฟล์ BOT Level.99'}).click();await page.getByText('คู่ฝึกซ้อม AI · ไม่จัดอันดับผู้เล่น').waitFor();assert.equal(await page.locator('.bpp-friend').count(),0);assert.equal(await page.locator('.bpp-stats').count(),0);await page.keyboard.press('Escape');
  await left.click();await dialog.waitFor();
  await page.evaluate(()=>{const button=document.createElement('button');button.id='battle-action';button.style='position:fixed;right:10px;bottom:10px';button.textContent='Play';button.onclick=()=>window.battleAction=true;document.body.append(button)});
  await page.locator('#battle-action').click();assert.equal(await page.evaluate(()=>window.battleAction),true,'Battle remains interactive while the mini profile is open');await dialog.waitFor({state:'detached'});
  assert.deepEqual(errors,[]);await context.close();console.log(`${width}x${height}: frameless mirrored art, anchored nonmodal profile, unobstructed battle, live stats and friend states passed`);
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
