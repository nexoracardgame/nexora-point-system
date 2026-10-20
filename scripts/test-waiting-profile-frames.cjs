const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const modules={};
for(const [id,pkg,file] of [['react','react','react.production.js'],['react/jsx-runtime','react','react-jsx-runtime.production.js'],['react-dom','react-dom','react-dom.production.js'],['react-dom/client','react-dom','react-dom-client.production.js'],['scheduler','scheduler','scheduler.production.js']])modules[id]=fs.readFileSync(path.join(path.dirname(require.resolve(pkg)),'cjs',file),'utf8');
modules['lucide-react']=fs.readFileSync(require.resolve('lucide-react'),'utf8');
for(const [id,file] of [['waiting','components/BattleWaitingRoom.tsx'],['./BattlePlayerProfile','components/BattlePlayerProfile.tsx'],['@/lib/battle-command-queue','lib/battle-command-queue.ts']])modules[id]=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
modules['@/lib/game-profile-client']=`exports.cachedGameProfile=()=>null;exports.loadGameProfile=async id=>({user:{id,name:'Player',image:'/avatar.png'},appearance:{},stats:{wins:100,losses:20},rank:{name:'DIAMOND',nextWins:null}});`;
for(const id of ['./BattleWaitingHeader','./GamePreparationBackground'])modules[id]='exports.__esModule=true;exports.default=()=>null;';
const css=['app/globals.css','components/BattleHud.css','components/BattlePlayerProfile.css','components/BattleWaitingRoom.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n');
const app=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(id.endsWith('.css'))return {};if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports;}const R=require('react'),Waiting=require('waiting').default;const props={seats:{host:{id:'a',name:'ผู้เล่นชื่อยาวมาก NEXORA Champion',image:'/avatar.png'},challenger:{id:'pentad-bot',name:'BOT Level.99 · B',image:'/avatar.png'}},spectators:[],userId:'a',leaderId:'a',modes:[{id:'all',title:'ALL IN ONE',description:'มอนสเตอร์ + สกิล'}],mode:'all',canChange:true,onMode:()=>{},onWatch:()=>{},onTake:()=>{},onBot:()=>{}};require('react-dom/client').createRoot(document.getElementById('root')).render(R.createElement(Waiting,{...props,chat:R.createElement('section',{className:'triad-battle-chat-hud'},R.createElement('div',{className:'triad-chat-hud-messages'}),R.createElement('form',null,R.createElement('input',{placeholder:'Chat'})))}));`;
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const [width,height] of [[3840,2160],[1920,1080],[1366,768],[844,390],[667,375],[640,360]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error(error.message)});
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><style>${css}html,body{margin:0;height:100%;background:#111}#root{height:calc(100% - 78px);padding-top:78px;box-sizing:content-box}.nexora-shared-waiting{height:100%}@media(max-height:600px){#root{height:calc(100% - 48px);padding-top:48px}}</style><div id="root"></div>`});
    const file=path.join(process.cwd(),'public',url.pathname);
    if((url.pathname.startsWith('/images/lobby-play/')||url.pathname==='/avatar.png')&&fs.existsSync(file))return route.fulfill({path:file});
    return route.abort();
   });
   await page.goto('http://waiting.test/');await page.addScriptTag({content:app});
   await page.waitForFunction(()=>document.querySelector('.bpi-rank>span')?.textContent==='DIAMOND');
   await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
   assert.equal(await page.locator('.battle-player-identity').count(),2);
   assert.equal(await page.locator('.bpi-badge').count(),2);
   assert.equal(await page.locator('.bpi-rank>span').nth(1).textContent(),'BOT');
   const bounds=await page.locator('.nsw-framed-identity').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}));
   assert.equal(bounds[0].w,bounds[1].w,'Both sides share exact dimensions');
   for(const b of bounds)assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=width+1&&b.y+b.h<=height+1,'Frames fit landscape');
   assert.ok(await page.locator('.bpi-copy strong').evaluateAll(nodes=>nodes.every(node=>node.scrollWidth<=node.clientWidth+1&&node.scrollHeight<=node.clientHeight+1)),'Names fit their artwork lines');
   const chat=await page.locator('.nsw-chat').boundingBox();assert.ok(bounds.every(b=>b.y+b.h<=chat.y),`Frames clear chat: ${JSON.stringify({bounds,chat})}`);
   await page.locator('.triad-chat-hud-messages').evaluate(node=>node.innerHTML='<div>Message</div>'.repeat(80));
   const after=await page.locator('.nsw-framed-identity').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}));assert.deepEqual(after,bounds,'Chat never shifts framed profiles');
   fs.mkdirSync('artifacts/waiting-profiles',{recursive:true});await page.screenshot({path:`artifacts/waiting-profiles/${width}x${height}.png`});
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.bpi-avatar').first().evaluate(node=>getComputedStyle(node,'::after').animationName),'none');
   assert.deepEqual(errors,[]);await page.close();console.log(`${width}x${height}: two framed profiles, live rank, fitted names, chat isolation, assets and reduced motion passed`);
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
