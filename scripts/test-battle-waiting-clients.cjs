const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-heptad-ui.cjs','utf8');
const load=require('./game-collection-test-loader.cjs')({'./prisma':{prisma:{}}});
const actor={id:'a',name:'Player A',image:'/avatar.png'};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const mode of ['pentad','heptad']){
  const setup=new Function('require',fixture.slice(0,fixture.indexOf("add('client'"))+'return {modules,css,add,overrides};')(require);
  setup.overrides['@/components/BattleVersusIntro']='exports.__esModule=true;exports.default=()=>null;';
  setup.modules['next/link']=`exports.__esModule=true;exports.default=({children})=>children;`;
  setup.add('client',mode==='pentad'?'app/(main)/battle/pentad-dominion/PentadDominionClient.tsx':'app/game/heptad/HeptadClient.tsx');
  for(const file of ['app/globals.css','components/BattleHud.css','components/BattlePlayerProfile.css','components/GameWindowControls.css'])setup.css.set(file,fs.readFileSync(file,'utf8'));
  const store=load(`lib/${mode}-room-store.ts`),create=store[mode==='pentad'?'newPentadRoom':'newHeptadRoom'],apply=store[mode==='pentad'?'applyPentadAction':'applyHeptadAction'],tick=store[mode==='pentad'?'tickPentadRoom':'tickHeptadRoom'],view=store[mode==='pentad'?'publicPentadRoom':'publicHeptadRoom'];
  let room,serial=100,delay=500,active=0,maxActive=0,requests=[];
  const props=mode==='pentad'?{userId:'a',initialRoomCode:'123456'}:{userId:'a',initialCode:'123456',spectate:false};
  const bundle=`const modules=${JSON.stringify(setup.modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};if(!modules[id])throw Error('Missing '+id);new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}require('react-dom/client').createRoot(document.getElementById('root')).render(require('react').createElement(require('client').default,${JSON.stringify(props)}));`;
  const html=`<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;font:16px Arial;color:white}button,input{font:inherit;color:inherit}input{background:transparent}button{background:none;border:0}${[...setup.css.values()].join('\n')}</style><div id="root" class="nexora-pentad-shell"></div><script>${bundle}</script>`;
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://clients.test/**',async route=>{
   const url=new URL(route.request().url());if(url.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:html});
   if(url.pathname==='/api/'+mode+'-rooms'){
    try{
     if(route.request().method()==='POST'){
      const body=route.request().postDataJSON();requests.push(body.action);
      if(['watch','seat','bot','mode','start','leave'].includes(body.action)){active++;maxActive=Math.max(maxActive,active);await sleep(delay);active--;}
      apply(room,actor,body);tick(room);
     }else tick(room);
     room.version=++serial;return route.fulfill({json:{room:view(room,actor.id)}});
    }catch(error){return route.fulfill({status:409,json:{error:error.message}});}
   }
   if(url.pathname==='/api/battle-chat')return route.fulfill({json:{messages:[]}});
   if(url.pathname.startsWith('/api/'))return route.fulfill({json:{profile:{id:'bot',name:'BOT',rankName:'Bronze',wins:0,losses:0},relation:{status:'none'}}});
   const file=path.resolve('public','.'+url.pathname);return file.startsWith(path.resolve('public')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({body:fs.readFileSync(file)}):route.abort();
  });
  for(const [width,height] of [[1920,1080],[844,390],[568,320]]){
   room=create('123456',actor);requests=[];maxActive=0;delay=500;
   await page.setViewportSize({width,height});await page.goto('http://clients.test/');await page.getByRole('button',{name:'ไปนั่งชม',exact:true}).waitFor();
   const dock=await page.locator('.nsw-chat').boundingBox(),seats=await page.locator('.nsw-seats').boundingBox();assert.ok(Math.abs(dock.y+dock.height-(seats.y+seats.height-1))<1,'Shared waiting chat sits on the border above mode settings');
   const settings=await page.locator('.nsw-settings').boundingBox();
   const seatBottoms=await page.locator('.nsw-person>*').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect()).filter(rect=>rect.width&&rect.height).map(rect=>rect.bottom));assert.ok(seatBottoms.every(bottom=>bottom<=dock.y+1)&&dock.y+dock.height<=settings.y,'Seat controls, border chat and mode settings do not overlap');
   await page.getByRole('button',{name:'ไปนั่งชม',exact:true}).click();
   await page.getByRole('button',{name:'ลงสนาม',exact:true}).first().click();
   await page.getByRole('button',{name:'เพิ่มบอทลงสนาม ฝั่ง B',exact:true}).click();
   await page.locator('.nsw-modes button').nth(1).click();await page.locator('.nsw-modes button').first().click();
   await page.getByRole('button',{name:'เริ่มเกม',exact:true}).click();
   await page.locator(`[data-${mode}-phase="deck"]`).waitFor();assert.equal(maxActive,1,'Dependent waiting mutations stay ordered');
   assert.deepEqual(requests.filter(action=>['watch','seat','bot','mode','start'].includes(action)),['watch','seat','bot','mode','start']);
   await page.getByRole('button',{name:'เติมเด็ค',exact:true}).click();await page.getByRole('button',{name:mode==='pentad'?'พร้อม':'ยืนยันเด็ค 105 ใบ',exact:true}).click();
   await page.locator(`[data-${mode}-phase="select"]`).waitFor();
   await page.waitForTimeout(100);
   const chat=await page.locator('.triad-battle-chat-hud').boundingBox(),hand=await page.locator('.nexora-arena-hand').boundingBox();if(chat.y+chat.height>hand.y+1){console.error({mode,width,chat,hand,frame:await page.locator('.triad-battle-chat-hud-frame').getAttribute('style')});fs.mkdirSync('artifacts/battle-waiting-clients',{recursive:true});await page.screenshot({path:'artifacts/battle-waiting-clients/failure.png'});}assert.ok(chat.y+chat.height<=hand.y+1,'Battle chat clears the hand');
   assert.deepEqual(errors,[]);fs.mkdirSync('artifacts/battle-waiting-clients',{recursive:true});await page.screenshot({path:`artifacts/battle-waiting-clients/${mode}-${width}.png`});
   const cards=await page.locator('.heptad-slot,.nexora-arena-formation button').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}));
   for(const card of cards)assert.ok(chat.x+chat.width<=card.x+1||card.x+card.w<=chat.x+1||chat.y+chat.height<=card.y+1||card.y+card.h<=chat.y+1,'Chat does not cover a battlefield card');
   delay=2000;await page.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();await page.waitForFunction(()=>window.navigationTarget==='/game',{timeout:1000});await sleep(2100);
   console.log(`${mode} ${width}: rapid watch/seat/bot/mode/start, shared chat, deck ready and immediate exit passed`);
  }
  await page.close();
 }
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
