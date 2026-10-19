const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-monsters.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle='))+'return modules;')(require);
const compile=(file)=>ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
for(const name of ['pentad-dominion','pentad-element-presentation']){
 modules['@/lib/'+name]=compile('lib/'+name+'.ts');modules['./'+name]='module.exports=require("@/lib/'+name+'");';
}
modules.clash=compile('app/(main)/battle/pentad-dominion/PentadElementClash.tsx');
for(const name of ['@/components/BattleVersusIntro.css','@/components/BattleCardGeometry.css','./PentadElementClash.css'])modules[name]=' ';
const bundle=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;if(!modules[id])throw Error('Missing '+id);const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports;}const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root'));window.finished=0;window.renderClash=(a='water',b='fire',turn=1,finalDuel=false)=>{const cards=require('@/lib/triad-dominion').triadCards;const mains={host:cards.find(c=>c.kind==='monster'&&c.element===a).cardNo,challenger:cards.find(c=>c.kind==='monster'&&c.element===b).cardNo};const round={...require('@/lib/pentad-dominion').resolvePentadTurn({fight:2,turn,mains,skills:{host:'',challenger:''},opener:'host',finalDuel}),id:Math.random(),fight:2,turn,finalDuel,mains};root.render(React.createElement(require('clash').default,{key:round.id,round,room:{seats:{host:{name:'NEXORA Player'},challenger:{name:'BOT Level.99'}}},arenaImage:'/images/versus/arena.png',onComplete:()=>{window.finished++}}));};renderClash();`;
const css=['components/BattleVersusIntro.css','components/BattleCardGeometry.css','app/(main)/battle/pentad-dominion/PentadElementClash.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n');
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(`<meta charset="utf-8"><style>body{margin:0}${css}</style><div id="root"></div><script>${bundle}</script>`);}
  const file=path.resolve('public','.'+decodeURIComponent(pathname));
  if(!file.startsWith(path.resolve('public')+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',file.endsWith('.ttf')?'font/ttf':file.endsWith('.jpg')?'image/jpeg':file.endsWith('.png')?'image/png':'image/webp');fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  fs.mkdirSync('artifacts/element-clash',{recursive:true});
  for(const [width,height]of [[1920,1080],[3840,2160],[1280,720],[844,390],[667,375],[568,320]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error(error.message)});
   await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto(`http://127.0.0.1:${server.address().port}`);
   await page.locator('.nexora-element-clash').waitFor();
   await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0));
   await page.clock.runFor(1800);await page.waitForFunction(()=>document.querySelector('.nexora-element-clash').dataset.resolved==='true');
   assert.equal(await page.locator('[data-outcome=winner]').getAttribute('data-side'),'host');
   assert.equal(await page.locator('.nec-heading h1').innerText(),'ธาตุน้ำชนะ');
   assert.equal(await page.locator('.nec-card').count(),2);assert.equal(await page.locator('.nec-crystal').count(),2);
   for(const selector of ['.nec-card-entry','.nec-crystal-entry','.nec-identity','.nec-heading','.nec-result'])for(const node of await page.locator(selector).all()){
    const r=await node.boundingBox();assert.ok(r.x>=-1&&r.y>=-1&&r.x+r.width<=width+1&&r.y+r.height<=height+1,selector+' out of viewport '+width+JSON.stringify(r));
   }
   assert.equal(await page.locator('.nec-card').first().evaluate(node=>getComputedStyle(node).borderRadius.includes('%')),true);
   assert.equal(await page.locator('.nec-crystal-window img').first().evaluate(img=>getComputedStyle(img).left.startsWith('-')),true);
   await page.screenshot({path:`artifacts/element-clash/${width}.png`,animations:'disabled'});
   const before=await page.evaluate(()=>finished);await page.clock.runFor(5990);assert.equal(await page.evaluate(()=>finished),before);await page.clock.runFor(20);assert.equal(await page.evaluate(()=>finished),before+1,'Result held for six seconds');
   await page.emulateMedia({reducedMotion:'reduce'});
   for(const [a,b,title]of [['fire','water','ธาตุน้ำชนะ'],['fire','fire','ธาตุเสมอ'],['wood','fire','ธาตุเสริมพลัง'],['gold','wood','ธาตุทองชนะ'],['earth','water','ธาตุดินชนะ']]){
    await page.evaluate(([a,b])=>renderClash(a,b),[a,b]);await page.clock.runFor(1801);assert.equal(await page.locator('.nec-heading h1').innerText(),title);
    assert.equal(await page.locator('.nec-crystal-window img').count(),2);
   }
   await page.evaluate(()=>renderClash('water','fire',2));await page.clock.runFor(1);assert.equal(await page.locator('.nexora-element-clash').count(),0,'Not shown for turns 2-5');
   await page.evaluate(()=>renderClash('water','fire',1,true));await page.clock.runFor(1);assert.equal(await page.locator('.nexora-element-clash').count(),0,'Not shown for final power-only duel');
   assert.deepEqual(errors,[]);await page.close();console.log(width+'x'+height+': crystals/cards, element outcomes, six-second hold, later-turn exclusion passed');
  }
 }finally{await browser.close();server.closeAllConnections();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
