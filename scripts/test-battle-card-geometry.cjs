const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root='app/(main)/battle/';
const cinematic=fs.readFileSync(root+'triad-dominion/BattleCinematic.module.css','utf8');
const pentad=fs.readFileSync(root+'pentad-dominion/PentadDominion.module.css','utf8');
const geometry=fs.readFileSync('components/BattleCardGeometry.css','utf8');
const hud=fs.readFileSync('components/BattleHud.css','utf8');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 fs.mkdirSync('artifacts/battle-card-geometry',{recursive:true});
 for(const [width,height] of [[1920,1080],[1280,720],[844,390],[667,375],[568,320]]){
  const page=await browser.newPage({viewport:{width,height}});
  await page.route('http://geometry.test/**',route=>route.fulfill({path:'public/cards/001.jpg'}));
  for(const mode of ['triad','pentad','skill','reveal']){
   const size=Math.min(height*.42,300),cardWidth=size*815/1110;
   const face=mode==='pentad'?'<button class="card"><span class="nexora-card-art-frame"><img src="/card.webp"></span></button>':mode==='skill'?'<span class="skillTransfer"><img data-battle-card-face src="/card.webp"></span>':mode==='triad'?'<div class="card" data-battle-card-face><img src="/card.webp"></div>':'<div data-battle-card-face style="width:var(--card-width);aspect-ratio:815/1110"><img src="/card.webp" style="width:100%;height:100%"></div>';
   await page.setContent(`<base href="http://geometry.test/"><style>${mode==='pentad'?pentad:cinematic}${hud}${geometry}body{margin:0;background:#23ad79}.fixture{display:flex;gap:30px;padding:30px;--card-width:${cardWidth}px}.fixture>.card{width:var(--card-width);height:auto;aspect-ratio:815/1110}.fixture .skillTransfer{display:block;position:relative;left:auto;top:auto;width:var(--card-width);transform:none;animation:none}.fixture img{display:block}.fixture>[data-battle-card-face],.fixture>.card{filter:none}</style><div class="fixture">${face}${face}</div>`);
   await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
   const selector=mode==='pentad'?'.nexora-card-art-frame':mode==='skill'?'.skillTransfer>img':'.fixture>[data-battle-card-face]';
   const cards=page.locator(selector);assert.equal(await cards.count(),2);
   const values=await cards.evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return{width:r.width,height:r.height,radius:s.borderTopLeftRadius,overflow:s.overflow}}));
   assert.equal(values[0].width,values[1].width);assert.equal(values[0].height,values[1].height);
   for(const value of values){assert.ok(Math.abs(value.width/value.height-815/1110)<.002,`${mode}: standard card ratio`);assert.equal(value.radius,'4% 2.94%');assert.equal(value.overflow,'hidden')}
   assert.ok(await cards.locator('img').evaluateAll(nodes=>nodes.every(node=>node.complete&&node.naturalWidth>0))||mode==='skill');
   await page.screenshot({path:`artifacts/battle-card-geometry/${mode}-${width}.png`});
  }
  await page.close();console.log(`${width}x${height}: triad, pentad, skill and reveal use identical paired sizes, ratio and rounded clipping`);
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
