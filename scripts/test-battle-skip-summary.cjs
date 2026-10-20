const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const source=fs.readFileSync('scripts/test-waiting-profile-frames.cjs','utf8');
const modules=new Function('require',source.slice(0,source.indexOf('const css='))+'return modules;')(require);
modules.summary=ts.transpileModule(fs.readFileSync('components/BattleSkipSummary.tsx','utf8'),{compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
const script=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(id.endsWith('.css'))return {};if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports;}require('react-dom/client').createRoot(document.getElementById('root')).render(require('react').createElement(require('summary').default));`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const [width,height] of [[3840,2160],[1920,1080],[1366,768],[844,390],[667,375]]){
  const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(`<meta charset="utf-8"><style>${fs.readFileSync('components/BattleSkipSummary.css','utf8')}body{background:#17242b;margin:0}.nexora-arena-header{position:fixed;top:0;left:0;width:100%;height:48px}.nexora-arena-scoreplate{position:fixed;top:50px;right:0;width:30%;height:55px}.nexora-card-art-frame{position:fixed;top:30%;left:45%;width:12%;height:30%}.nexora-arena-hand{position:fixed;bottom:0;width:100%;height:60px}</style><div class="nexora-arena-header"></div><div class="nexora-arena-scoreplate"></div><div class="nexora-card-art-frame"></div><div class="nexora-arena-hand"></div><div id="root"></div>`);
  await page.addScriptTag({content:script});await page.waitForTimeout(50);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('nexora:round-skipped',{detail:{winner:'opponent',player:'S1R 3AZ',opponent:'BOT Level.99 · B',a:2900,b:9200,reason:'SUPPORT หลัก + รอง'}})));
  const panel=page.locator('.battle-skip-summary');await panel.waitFor();
  assert.equal(await panel.locator('h2').textContent(),'BOT Level.99 · B');assert.ok((await panel.textContent()).includes('6,300'));
  const rect=await panel.boundingBox();assert.ok(rect.x>width/2&&rect.y>=105&&rect.y+rect.height<=height-60);
  assert.ok(await panel.evaluate(node=>node.scrollWidth<=node.clientWidth+1),'No overflowing text');
  assert.equal(await panel.evaluate(node=>getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0)');
  assert.equal(await panel.evaluate(node=>getComputedStyle(node).borderTopWidth),'0px');
  assert.equal(await panel.locator('h2').evaluate(node=>getComputedStyle(node).color),'rgb(8, 11, 14)');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await panel.evaluate(node=>getComputedStyle(node).animationName),'none');
  fs.mkdirSync('artifacts/skip-summary',{recursive:true});await page.screenshot({path:`artifacts/skip-summary/${width}.png`});
  await panel.waitFor({state:'detached',timeout:4000});assert.deepEqual(errors,[]);await page.close();console.log(`${width}x${height}: clear winner, separate power rows, right placement, reduced motion and 3s cleanup passed`);
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
