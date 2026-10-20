const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-monsters.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle='))+'return modules;')(require);
const css=new Map(),loaded=new Set();
const overrides={
 'next/navigation':`const router={prefetch:()=>{},replace:path=>{window.navigationTarget=path}};exports.useRouter=()=>router;`,
 '@/lib/supabase-browser':'exports.getBrowserSupabaseClient=()=>null;',
 '@/lib/battle-surrender-dialog':'exports.confirmBattleLeave=async()=>window.confirmLeave!==false;exports.confirmBattleSurrender=async()=>true;',
 '@/lib/game-ui-audio':'exports.playGameUiSound=()=>{};',
 '@/app/(main)/battle/triad-dominion/BattleAudio':'exports.battleAudioReady=()=>false;exports.playBattleSequence=()=>()=>{};exports.primeBattleAudio=async()=>false;exports.playMenuCue=()=>{};',
};
function add(id,file){
 const absolute=path.resolve(file);if(loaded.has(absolute)){modules[id]=modules[absolute];return;}loaded.add(absolute);
 if(file.endsWith('.css')){
  let source=fs.readFileSync(file,'utf8');
  if(file.endsWith('.module.css')){const prefix='test_'+path.basename(path.dirname(file)).replace(/\W/g,'')+'_';source=source.replace(/\.([a-zA-Z_][\w-]*)/g,(_,name)=>'.'+prefix+name);modules[absolute]=`exports.__esModule=true;exports.default=new Proxy({},{get:(_,key)=>${JSON.stringify(prefix)}+key});`;}
  else modules[absolute]=' ';
  css.set(absolute,source);modules[id]=modules[absolute];return;
 }
 if(file.endsWith('.json')){modules[absolute]='module.exports='+fs.readFileSync(file,'utf8');modules[id]=modules[absolute];return;}
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
 const requests=[...source.matchAll(/require\("([^"\n]+)"\)/g)].map(match=>match[1]);
 let output=source;
 for(const request of requests){
  if(overrides[request]){modules[request]=overrides[request];continue;}
  if(request.startsWith('.')||request.startsWith('@/')){
   let resolved=request.startsWith('@/')?path.resolve(request.slice(2)):path.resolve(path.dirname(file),request);
   if(!fs.existsSync(resolved)){if(fs.existsSync(resolved+'.tsx'))resolved+='.tsx';else if(fs.existsSync(resolved+'.ts'))resolved+='.ts';else throw Error('Missing '+resolved);}
   const overrideKey='@/'+path.relative(process.cwd(),resolved).replace(/\\/g,'/').replace(/\.(tsx?|jsx?)$/,'');
   if(overrides[overrideKey])modules[resolved]=overrides[overrideKey];else add(resolved,resolved);
   output=output.replaceAll(`require(${JSON.stringify(request)})`,`require(${JSON.stringify(resolved)})`);
  }
 }
 modules[absolute]=modules[id]=output;
}
add('client','app/game/heptad/HeptadClient.tsx');
add('viewport','components/NativeViewportBridge.tsx');
for(const file of ['app/globals.css','components/BattleHud.css','components/BattlePlayerProfile.css','components/GameWindowControls.css'])css.set(file,fs.readFileSync(file,'utf8'));
const bundle=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};if(!modules[id])throw Error('Missing module '+id);new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}const React=require('react');require('react-dom/client').createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,React.createElement(require('viewport').default),React.createElement(require('client').default,{userId:'a',initialCode:'123456',spectate:false})));`;
const html=`<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial}button,input,select{font:inherit}button{color:inherit}${[...css.values()].join('\n')}</style><div class="nexora-pentad-shell" id="root"></div><script>${bundle}</script>`;
const load=require('./game-collection-test-loader.cjs')({'./prisma':{prisma:{}}}),store=load('lib/heptad-room-store.ts'),rules=load('lib/heptad-rules.ts');
const actor={id:'a',name:'ผู้เล่นทดสอบ',image:'/avatar.png'},rival={id:'b',name:'คู่ต่อสู้',image:'/avatar.png'};
let room,version=100,leaveDelay=0;
function fresh(){room=store.newHeptadRoom('123456',actor);return room;}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error('Browser:',error.message)});
 await page.route('http://heptad.test/**',async route=>{
  const url=new URL(route.request().url());if(url.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:html});
  if(url.pathname.startsWith('/api/')){
   if(url.pathname==='/api/battle-chat')return route.fulfill({json:{messages:[]}});
   if(url.pathname!=='/api/heptad-rooms')return route.fulfill({json:{profile:{id:'bot',name:'BOT',rankName:'Bronze',wins:0,losses:0},relation:{status:'none'}}});
   try{if(route.request().method()==='POST'){const body=route.request().postDataJSON();if(body.action==='leave'&&leaveDelay)await new Promise(resolve=>setTimeout(resolve,leaveDelay));store.applyHeptadAction(room,actor,body);}
    store.tickHeptadRoom(room);room.version=++version;return route.fulfill({json:{room:store.publicHeptadRoom(room,actor.id)}});
   }catch(error){return route.fulfill({status:409,json:{error:error.message}});}
  }
  const file=path.resolve('public','.'+url.pathname);if(!file.startsWith(path.resolve('public')+path.sep)||!fs.existsSync(file))return route.abort();
  return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':file.endsWith('.mp4')?'video/mp4':'image/jpeg'});
 });
 for(const [width,height] of [[1920,1080],[844,390],[667,375]]){
  fresh();await page.setViewportSize({width,height});await page.goto('http://heptad.test/');await page.locator('[data-heptad-phase="waiting"]').waitFor();
  await page.getByRole('button',{name:'เพิ่มบอทลงสนาม ฝั่ง B',exact:true}).click();await page.getByRole('button',{name:'เอาบอทออก ฝั่ง B',exact:true}).waitFor();
  await page.getByRole('button',{name:'ไปนั่งชม',exact:true}).click();await page.getByRole('button',{name:'เพิ่มบอทลงสนาม ฝั่ง A',exact:true}).waitFor();
  await page.getByRole('button',{name:'ลงสนาม',exact:true}).first().click();await page.getByRole('button',{name:'ไปนั่งชม',exact:true}).waitFor();
  const start=page.locator('[data-room-actions] button').filter({hasText:'เริ่ม'});assert.equal(await start.count(),1);await start.click();
  await page.locator('[data-heptad-phase="deck"]').waitFor();await page.getByRole('button',{name:'เติมเด็ค',exact:true}).click();await page.getByRole('button',{name:'ยืนยันเด็ค 105 ใบ',exact:true}).click();
  await page.locator('[data-heptad-phase="select"],[data-heptad-phase="result"]').waitFor();
  const field=await page.locator('.heptad-field').boundingBox();assert.ok(field.x>=0&&field.y>=0&&field.width>0&&field.height>0&&field.x+field.width<=width+1&&field.y+field.height<=height+1,'Field fits '+width);
  assert.equal(await page.locator('.heptad-slot').count(),14);assert.deepEqual(errors,[]);
  const chat=await page.locator('.triad-battle-chat-hud').boundingBox(),hand=await page.locator('.nexora-arena-hand').boundingBox();
  assert.ok(chat&&hand&&chat.y+chat.height<=hand.y,'Chat does not overlap the hand at '+width);
  // Capture composition without the initial VS animation obscuring the field.
  await page.locator('.nexora-versus-plane').evaluateAll(nodes=>nodes.forEach(node=>{node.style.visibility='hidden';node.style.pointerEvents='none'}));
  fs.mkdirSync('artifacts/heptad-ui',{recursive:true});await page.screenshot({path:`artifacts/heptad-ui/${width}.png`});
  console.log(`HEPTAD UI ${width}: join, bots, spectator seat, 105-card deck, ready and 14-slot field passed`);
 }
 leaveDelay=3000;
 await page.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();await page.waitForFunction(()=>window.navigationTarget==='/game',{timeout:1000});
 assert.deepEqual(errors,[]);console.log('HEPTAD UI: exit does not wait on a 3-second server response');
 await page.waitForTimeout(3200);
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
