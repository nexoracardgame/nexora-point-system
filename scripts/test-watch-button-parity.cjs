const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-monsters.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle='))+'return modules;')(require);
modules.waiting=ts.transpileModule(fs.readFileSync('components/BattleWaitingRoom.tsx','utf8'),{fileName:'waiting.tsx',compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
modules['./BattleWaitingRoom.css']=' ';modules['./GamePreparationBackground']='module.exports=()=>null;';
const script=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports;}const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root'));window.clicked=0;window.renderMode=mode=>{const modes=mode==='triad'?[{id:'all',title:'ALL IN ONE',description:'มอนสเตอร์ + สกิล'},{id:'monster',title:'MONSTER',description:'มอนสเตอร์ล้วน'},{id:'skill',title:'SKILL',description:'10 มอนสเตอร์ + 10 สกิล'}]:[{id:'all',title:'ALL CARDS',description:'เลือกจากการ์ดทั้งหมด'},{id:'random',title:'RANDOM POOL',description:'สุ่มพูลการ์ด'}];root.render(React.createElement('main',{className:mode==='triad'?'nexora-command triad-room-screen':'test-pentad'},React.createElement(require('waiting').default,{seats:{host:{id:'me',name:'NEXORA'},challenger:null},spectators:[],userId:'me',leaderId:'me',modes,mode:'all',canChange:true,onMode:()=>{},onWatch:()=>{window.clicked++},onTake:()=>{}})));};renderMode('triad');`;
const shared=fs.readFileSync('components/BattleWaitingRoom.css','utf8'),triad=fs.readFileSync('app/(main)/battle/triad-dominion/NexoraCommand.css','utf8'),pentad=fs.readFileSync('app/(main)/battle/pentad-dominion/PentadDominion.module.css','utf8').replace(/\.shell\b/g,'.test-pentad');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 fs.mkdirSync('artifacts/watch-button',{recursive:true});
 for(const [width,height]of [[3840,2160],[1920,1080],[1280,720],[844,390],[667,375],[568,320]])for(const order of ['shared-first','shared-last']){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error(error.message)});
  await page.route('http://watch.test/**',route=>new URL(route.request().url()).pathname==='/avatar.png'?route.fulfill({path:'public/avatar.png'}):route.fulfill({body:'',status:404}));
  await page.setContent(`<meta charset="utf-8"><style>body{margin:0;font:14px Arial}button{font:inherit}#root{height:100vh}.triad-room-screen{height:100vh;background:#080e13;isolation:isolate}${triad}${order==='shared-first'?shared+pentad:pentad+shared}</style><div id="root"></div><script>${script}</script>`);
  let expected;
  for(const mode of ['triad','pentad']){
   await page.evaluate(mode=>renderMode(mode),mode);const button=page.getByRole('button',{name:'ไปนั่งชม',exact:true});await button.waitFor();
   const actual=await button.evaluate(node=>{const s=getComputedStyle(node),r=node.getBoundingClientRect(),icon=node.querySelector('svg').getBoundingClientRect();return{width:r.width,height:r.height,font:s.font,padding:s.padding,margin:s.margin,gap:s.gap,border:s.border,borderRadius:s.borderRadius,iconWidth:icon.width,iconHeight:icon.height}});
   if(expected)assert.deepEqual(actual,expected,`${width} ${order} must match across both modes`);else expected=actual;
   const r=await button.boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height);
   await button.click();await page.screenshot({path:`artifacts/watch-button/${mode}-${width}-${order}.png`});
  }
  assert.equal(await page.evaluate(()=>clicked),2);assert.deepEqual(errors,[]);await page.close();
  console.log(`${width}x${height} ${order}: identical watch-button geometry, font, icon, spacing and working clicks`);
 }
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
