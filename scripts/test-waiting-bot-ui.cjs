const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-monsters.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle='))+'return modules;')(require);
modules.waiting=ts.transpileModule(fs.readFileSync('components/BattleWaitingRoom.tsx','utf8'),{fileName:'waiting.tsx',compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;modules['./BattleWaitingRoom.css']='';
const bundle=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root'));function App(){const[seats,setSeats]=React.useState({host:null,challenger:null});return React.createElement(require('waiting').default,{seats,spectators:Array.from({length:10},(_,i)=>({id:i?'viewer-'+i:'owner',name:'Viewer',image:'/avatar.png'})),userId:'owner',leaderId:'owner',modes:[{id:'all',title:'ALL CARDS',description:'มอนสเตอร์ + สกิล'}],mode:'all',canChange:!window.visitor,busy:false,onMode:()=>{},onWatch:()=>{},onTake:side=>{window.taken=side},onBot:(side,enabled)=>setSeats(current=>({...current,[side]:enabled?{id:'pentad-bot',name:'BOT Level.99',image:'/avatar.png'}:null}))})}root.render(React.createElement(App));`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 fs.mkdirSync('artifacts/waiting-bots',{recursive:true});
 for(const [width,height]of [[3840,2160],[1920,1080],[1280,720],[844,390],[667,375],[568,320]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://bots.test/**',route=>new URL(route.request().url()).pathname==='/avatar.png'?route.fulfill({path:'public/avatar.png'}):route.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><style>body{margin:0;background:#08131b;height:100vh;font-family:Arial}*{box-sizing:border-box}${fs.readFileSync('components/BattleWaitingRoom.css','utf8')}</style><div id="root" style="height:100vh"></div><script>${bundle}</script>`}));
  await page.goto('http://bots.test/');
  await page.locator('.nsw-spectator img').first().waitFor();
  const circles=await page.locator('.nsw-spectator,.nsw-spectator img').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return{width:r.width,height:r.height,radius:getComputedStyle(node).borderRadius,fit:getComputedStyle(node).objectFit}}));
  for(const circle of circles){assert.ok(Math.abs(circle.width-circle.height)<.1,'Spectator portrait cannot become oval');assert.equal(circle.radius,'50%')}
  for(const side of ['A','B']){const add=page.getByRole('button',{name:'เพิ่มบอทลงสนาม ฝั่ง '+side,exact:true});await add.waitFor();const r=await add.boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height);await add.click()}
  assert.equal(await page.getByRole('button',{name:/เอาบอทออก ฝั่ง/}).count(),2);await page.screenshot({path:`artifacts/waiting-bots/${width}.png`});
  await page.getByRole('button',{name:'เอาบอทออก ฝั่ง A',exact:true}).click();await page.getByRole('button',{name:'เพิ่มบอทลงสนาม ฝั่ง A',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'เอาบอทออก ฝั่ง B',exact:true}).count(),1);
  await page.getByRole('article',{name:'ฝั่ง A'}).getByRole('button',{name:'ลงสนาม',exact:true}).click();assert.equal(await page.evaluate(()=>window.taken),'host');
  assert.deepEqual(errors,[]);await page.close();console.log(`${width}x${height}: same shared layout, independent bot buttons, remove and take seat, all buttons fit`);
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
