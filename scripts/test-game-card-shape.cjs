const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage();await page.route('**/*',route=>route.fulfill({status:204}));
 for(const width of [320,390,844,1920]){
  await page.setViewportSize({width,height:900});
  await page.setContent(`<style>${fs.readFileSync('components/GameCardShape.css','utf8')}</style><div class="nexora-card-art-frame"><img id="battle" src="/_next/image?url=%2Fcards%2F006.jpg&w=256&q=75" width="120" height="164"></div><img id="album" src="/cards/thumbnails/006.webp" width="200" height="273"><img id="avatar" src="/avatar.png">`);
  for(const id of ['battle','album']){const shape=await page.locator('#'+id).evaluate(node=>({radius:getComputedStyle(node).borderRadius,clip:getComputedStyle(node).clipPath}));assert.equal(shape.radius,'3.5%');assert.ok(shape.clip.includes('3.5%'))}
  assert.equal(await page.locator('#avatar').evaluate(node=>getComputedStyle(node).clipPath),'none');
 }
 console.log('Shared card shape: direct/optimized battle images, album images and avatar isolation passed across 4 viewports');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
