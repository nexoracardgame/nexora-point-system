const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-heptad-ui.cjs','utf8');
const {modules,css,add}=new Function('require',fixture.slice(0,fixture.indexOf("add('client'"))+'return {modules,css,add};')(require);
css.set('app/globals.css',fs.readFileSync('app/globals.css','utf8'));
add('waiting','components/BattleWaitingRoom.tsx');
add('chat','components/BattleArenaChat.tsx');
for(const file of ['components/BattleHud.css','components/GameWindowControls.css','app/(main)/battle/triad-dominion/NexoraCommand.css','app/(main)/battle/pentad-dominion/PentadDominion.module.css','app/game/heptad/HeptadClient.css'])add(file,file);
const script=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};if(!modules[id])throw Error('Missing '+id);new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}
const React=require('react'),Waiting=require('waiting').default,Chat=require('chat').default;
function App(){const [state,setState]=React.useState({seats:{host:{id:'a',name:'Player A'},challenger:null},spectators:[],mode:'all'});const [text,setText]=React.useState('');
const update=(action,change)=>{window.started.push(action);return new Promise(resolve=>window.releases.push(()=>{setState(current=>change(current));window.completed.push(action);resolve(true)}));};
const modes=Array.from({length:window.modeCount},(_,i)=>({id:['all','monster','skill','gold'][i],title:['ALL','MONSTER','SKILL','GOLD'][i],description:'มอนสเตอร์ · สกิลทุกระดับ'}));
return React.createElement(Waiting,{...state,modes,userId:'a',leaderId:'a',canChange:true,code:'123456',onExit:()=>window.exited=true,onStart:()=>update('start',s=>s),onMode:mode=>update('mode:'+mode,s=>({...s,mode})),onWatch:()=>update('watch',s=>({...s,seats:{host:null,challenger:s.seats.challenger},spectators:[{id:'a',name:'Player A'}]})),onTake:side=>update('seat:'+side,s=>({...s,seats:{...s.seats,[side]:{id:'a',name:'Player A'}},spectators:[]})),onBot:(side,enabled)=>update('bot:'+side+':'+enabled,s=>({...s,seats:{...s.seats,[side]:enabled?{id:'pentad-bot',name:'BOT'}:null}})),chat:React.createElement(Chat,{messages:[],currentUserId:'a',draft:text,onDraftChange:setText,onSubmit:()=>true})});}
window.started=[];window.completed=[];window.releases=[];window.modeCount=Number(new URLSearchParams(location.search).get('count'));require('react-dom/client').createRoot(document.getElementById('root')).render(React.createElement(App));`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
 await page.route('http://waiting.test/**',route=>{const url=new URL(route.request().url());if(url.pathname==='/'){const mode=Number(url.searchParams.get('count'));const cls=mode===4?'heptad-scene':mode===2?'test_pentaddominion_shell':'nexora-command nexora-command-room triad-room-screen';return route.fulfill({contentType:'text/html; charset=utf-8',body:`<html data-game-window-controls="desktop"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#080d10;color:white;font:16px Arial}.nexora-battle-shell{position:fixed;inset:0;width:100%;height:100%}#root{position:fixed;inset:0;display:flex;flex-direction:column}${[...css.values()].join('\n')}</style><div class="nexora-battle-shell"><div id="root" class="${cls}"></div></div><div class="nexora-window-controls"><button>-</button><button>□</button><button>×</button></div><script>${script}</script></html>`});}const file=path.resolve('public','.'+url.pathname);return fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({body:fs.readFileSync(file)}):route.abort();});
 for(const [width,height] of [[3840,2160],[1920,1080],[1366,768],[844,390],[667,375],[568,320]]){
  const dimensions=[];
  for(const count of [3,2,4]){
   await page.setViewportSize({width,height});await page.goto(`http://waiting.test/?count=${count}`);await page.getByRole('button',{name:'ไปนั่งชม',exact:true}).waitFor({timeout:3000}).catch(async error=>{console.error(await page.locator('#root').innerHTML());throw error});
   const geometry=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};return {header:rect('.nexora-waiting-header'),exit:rect('[data-room-actions]>button'),actions:rect('[data-room-actions]'),chat:rect('.nsw-chat'),spectators:rect('.nsw-spectators'),footer:rect('.nsw-footer'),settings:rect('.nsw-settings'),chrome:rect('.nexora-window-controls')};});
   dimensions.push(geometry);
   assert.ok(geometry.chat.right<=geometry.spectators.x+1,'Chat has its own footer column');
   assert.ok(geometry.chat.bottom<=height&&geometry.settings.bottom<=geometry.footer.y+1,'Chat and spectators stay below settings');
   assert.ok(geometry.actions.right<=geometry.chrome.x,'Header actions clear native chrome');
   assert.ok(geometry.footer.bottom<=height+1,'Footer fits landscape viewport');
   const persons=await page.locator('.nsw-person').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return [...node.children].map(child=>child.getBoundingClientRect()).filter(r=>r.width&&r.height).map(child=>child.bottom)}).flat());
   assert.ok(persons.every(bottom=>bottom<=geometry.settings.y+1),'Seat identities and controls do not overlap settings');
   assert.deepEqual(errors,[]);
   fs.mkdirSync('artifacts/battle-waiting',{recursive:true});await page.screenshot({path:`artifacts/battle-waiting/${count}-${width}.png`});
  }
  for(const item of dimensions.slice(1)){assert.equal(item.header.h,dimensions[0].header.h,'Same header height');assert.equal(item.exit.h,dimensions[0].exit.h,'Same button height');assert.equal(item.exit.w,dimensions[0].exit.w,'Same button width');}
  console.log(`Waiting ${width}x${height}: three modes share header dimensions, isolated chat/footer and native-chrome clearance`);
 }
 await page.goto('http://waiting.test/?count=4');await page.getByRole('button',{name:'ไปนั่งชม',exact:true}).click();
 await page.getByRole('button',{name:'เพิ่มบอทลงสนาม ฝั่ง A',exact:true}).click();
 await page.getByRole('button',{name:'เพิ่มบอทลงสนาม ฝั่ง B',exact:true}).click();
 await page.locator('.nsw-modes button').nth(1).click();await page.locator('.nsw-modes button').nth(2).click();
 await page.getByRole('button',{name:'เริ่มเกม',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>window.started),['watch'],'No requests overlap dependent seat changes');
 assert.equal(await page.locator('.nsw-modes button[aria-pressed=true]').innerText(),'SKILL\nมอนสเตอร์ · สกิลทุกระดับ','Latest mode renders before any response');
 for(let i=0;i<5;i++){await page.evaluate(()=>window.releases.shift()());await page.waitForTimeout(30);}
 assert.deepEqual(await page.evaluate(()=>window.completed),['watch','bot:host:true','bot:challenger:true','mode:skill','start']);
 await page.goto('http://waiting.test/?count=4');await page.getByRole('button',{name:'ไปนั่งชม',exact:true}).click();await page.getByRole('button',{name:'เพิ่มบอทลงสนาม ฝั่ง A',exact:true}).click();await page.getByRole('button',{name:'ออกห้อง',exact:true}).click();await page.evaluate(()=>window.releases.shift()());await page.waitForTimeout(30);
 assert.equal(await page.evaluate(()=>window.exited),true);assert.deepEqual(await page.evaluate(()=>window.started),['watch'],'Exit cancels unsent bot changes');
 assert.deepEqual(errors,[]);console.log('Waiting interactions: immediate cross-control switching, queued start, latest mode and immediate exit passed');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
