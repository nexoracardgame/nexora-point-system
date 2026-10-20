const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const css=['app/(main)/battle/triad-dominion/NexoraCommand.css','app/(main)/battle/triad-dominion/NexoraLobbyDrawer.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const scale of [1,.65,1.5]){
  const page=await browser.newPage({viewport:{width:1800,height:1000}});
  await page.route('**/game-assets/**',route=>route.fulfill({path:path.join(process.cwd(),'public',new URL(route.request().url()).pathname)}));
  await page.goto('about:blank');
  await page.setContent(`<base href="http://drawer.test/"><style>${css}.nexora-command-lobby{position:relative;width:100%;height:100%}.nexora-command-lobby .nexora-command-sheet.nexora-create-drawer{position:absolute;left:0;top:0;bottom:auto;transform:scale(${scale});transform-origin:top left}</style><div class="nexora-command-lobby"><section class="nexora-command-sheet nexora-play-drawer nexora-create-drawer"><div class="nexora-command-sheet-body"><div class="nexora-command-segment" aria-label="การเข้าถึงห้อง"><button aria-pressed="true">Public</button><button aria-pressed="false">Private</button></div></div></section></div>`);
  await page.locator('.nexora-create-drawer').evaluate((node,scale)=>{node.style.setProperty('transform',`scale(${scale})`,'important');node.style.setProperty('animation','none','important')},scale);
  const buttons=page.locator('[aria-pressed]');
  for(let i=0;i<2;i++){
   const metrics=await buttons.nth(i).evaluate(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node),p=getComputedStyle(node,'::before');return {height:r.height,minHeight:s.minHeight,clip:s.clipPath,overlayHeight:p.height}});
   assert.equal(metrics.minHeight,'0px','Legacy minimum height cannot stretch the lighting');
   assert.ok(Math.abs(metrics.height-569.39*.0585*scale)<1,`Hit target follows artwork coordinates: ${JSON.stringify({scale,metrics})}`);
   assert.equal(metrics.clip,'polygon(18% 0px, 100% 0px, 83% 100%, 0px 100%)');
  }
  await page.evaluate(()=>{const buttons=document.querySelectorAll('[aria-pressed]');buttons[0].setAttribute('aria-pressed','false');buttons[1].setAttribute('aria-pressed','true')});
  fs.mkdirSync('artifacts/access-cut',{recursive:true});await page.screenshot({path:`artifacts/access-cut/scale-${scale}.png`});await page.close();
  console.log(`Access buttons scale ${scale}: exact artwork height and shared die-cut passed`);
 }
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
