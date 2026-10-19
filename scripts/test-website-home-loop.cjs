const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-website.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const script='))+'return modules;')(require);
const manifest=require('../public/game-assets/video/home-loop-2/manifest.json');
modules['@/lib/home-wallpaper']=ts.transpileModule(fs.readFileSync('lib/home-wallpaper.ts','utf8'),{fileName:'home-wallpaper.ts',compilerOptions:{module:1,target:9,esModuleInterop:true}}).outputText;
modules['./lobby-assets']='exports.loadLobbyAssets=async()=>{};';
for(const folder of ['home-loop','home-loop-2'])modules[`../public/game-assets/video/${folder}/manifest.json`]='module.exports='+fs.readFileSync(`public/game-assets/video/${folder}/manifest.json`,'utf8');
const bundle=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}window.sessionState={status:'unauthenticated',data:null};require('react-dom/client').createRoot(document.getElementById('root')).render(require('react').createElement(require('website').default));`;
const css=['components/GameWebsite.css','components/GameBattleTutorials.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n');
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(`<meta charset="utf-8"><style>body{margin:0}${css}</style><div id="root"></div><script>${bundle}</script>`);}
  const file=path.resolve('public','.'+pathname);
  if(!file.startsWith(path.resolve('public')+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  const size=fs.statSync(file).size,range=/bytes=(\d+)-(\d*)/.exec(req.headers.range||''),start=range?+range[1]:0,end=range?.[2]?Math.min(+range[2],size-1):size-1;
  res.writeHead(range?206:200,{'Content-Type':file.endsWith('.mp4')?'video/mp4':file.endsWith('.png')?'image/png':'image/webp','Content-Length':end-start+1,...(range?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});fs.createReadStream(file,{start,end}).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  fs.mkdirSync('artifacts/website-home-loop',{recursive:true});
  for(const [width,height,mobile,expected]of [[1920,1080,false,1920],[3840,2160,false,3840],[844,390,true,1280],[390,844,true,1280]]){
   const page=await browser.newPage({viewport:{width,height},isMobile:mobile,hasTouch:mobile}),errors=[],requests=[];
   await page.addInitScript(()=>Object.defineProperty(navigator,'deviceMemory',{get:()=>8}));
   page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
   await page.goto(`http://127.0.0.1:${server.address().port}`);
   await page.waitForFunction(w=>{const v=document.querySelector('video');return v?.videoWidth===w&&v.currentTime>.1},expected);
   const video=page.locator('video');assert.equal(await video.evaluate(v=>v.muted&&v.loop&&v.playsInline),true);
   const videoPath=new URL(await video.getAttribute('src'),page.url()).pathname;
   assert.ok(manifest.variants.some(variant=>variant.url===videoPath));
   assert.equal(await page.locator('.nx-site-hero>img').getAttribute('src'),manifest.poster);
   assert.equal(requests.some(url=>url.includes('/videos/')||url.includes('lobby-action-sprite')),false,'No login video or game-only artwork download');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:`artifacts/website-home-loop/${width}.png`});
   await video.evaluate(v=>{v.currentTime=9.7});await page.waitForFunction(()=>document.querySelector('video').currentTime<2);
   await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('video').paused);
   await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>!document.querySelector('video').paused);
   await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
   if(await video.evaluate(v=>v.getBoundingClientRect().bottom<=0))await page.waitForFunction(()=>document.querySelector('video').paused);
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(()=>!document.querySelector('video').paused);
   assert.equal(await page.locator('.nx-site-hero .nx-site-primary').first().getAttribute('href'),'/downloads/game-windows/current');
   assert.deepEqual(errors,[]);await page.close();
  }
  const page=await browser.newPage();await page.route('**/*.mp4',route=>route.abort());await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>!document.querySelector('video'));
  assert.equal(await page.locator('.nx-site-hero>img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
  await page.close();console.log('Website Loop 2: desktop/4K/mobile playback, repeat, shared game assets, poster fallback, reduced motion, offscreen pause and original download links passed');
 }finally{await browser.close();server.closeAllConnections();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
