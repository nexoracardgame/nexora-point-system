const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const css=['components/BattleHud.css','app/game/heptad/HeptadClient.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const [width,height]of [[3840,2160],[1920,1080],[1366,768],[844,390],[667,375]]){
  const page=await browser.newPage({viewport:{width,height}});
  await page.setContent(`<style>${css}body{margin:0;background:#17221e}.heptad-field{background:#fff1}</style><main class="heptad-scene" data-heptad-phase="special"><div class="heptad-field"></div><section class="heptad-special"><h2>การ์ดเสริมพิเศษ</h2><p>BOT Level.99 · B ประกาศเรียกก่อน · อีกฝ่ายเลือกเรียกหรือไม่เรียก</p><span>ใช้แล้ว 0/1 ครั้ง</span><div class="heptad-special-cards">${'<button class="heptad-hand-card" style="background:#da4">Card</button>'.repeat(5)}</div><button class="heptad-primary">ไม่เรียกการ์ดเสริม</button></section></main>`);
  const panel=await page.locator('.heptad-special').boundingBox(),field=await page.locator('.heptad-field').boundingBox();
  assert.ok(panel.x>=field.x+field.width,'Panel never covers battlefield');
  assert.ok(panel.y>=0&&panel.x+panel.width<=width&&panel.y+panel.height<=height,'Panel fits landscape viewport');
  const button=await page.locator('.heptad-primary').boundingBox();assert.ok(button.y+button.height<=panel.y+panel.height,'Pass action stays visible');
  assert.equal(await page.locator('.heptad-special').evaluate(node=>getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0.75)');
  assert.equal(await page.locator('.heptad-special').evaluate(node=>getComputedStyle(node,'::after').animationDuration),'5s');
  fs.mkdirSync('artifacts/heptad-special',{recursive:true});await page.screenshot({path:`artifacts/heptad-special/${width}x${height}.png`});
  await page.close();console.log(`${width}x${height}: right panel clears field, 75% black, gold orbit and visible controls passed`);
 }
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
