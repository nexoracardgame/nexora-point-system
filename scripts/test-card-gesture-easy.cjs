const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-card-gesture.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const script='))+'return modules;')(require);
const script=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}const R=require('react');window.chosen=0;window.preview=false;function App(){const [disabled,setDisabled]=R.useState(false);window.setDisabled=setDisabled;const props=require('gesture').useCardGesture({disabled,onChoose:()=>chosen++,onPreview:()=>preview=true,onPreviewEnd:()=>preview=false});return R.createElement('button',{...props,id:'card',style:{width:160,height:200}},'Card')}require('react-dom/client').createRoot(document.getElementById('root')).render(R.createElement(App));`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const delay of [60,250,500,680]){
  const page=await browser.newPage({hasTouch:true});await page.setContent('<div id="root"></div>');await page.addScriptTag({content:script});await page.locator('#card').waitFor();
  const box=await page.locator('#card').boundingBox();const x=box.x+50,y=box.y+50;
  for(let click=0;click<2;click++){await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+4,y+3);await page.waitForTimeout(100);await page.mouse.up();if(!click)await page.waitForTimeout(delay);}
  assert.equal(await page.evaluate(()=>chosen),1,`Mouse jitter and ${delay}ms interval select once`);
  assert.equal(await page.evaluate(()=>preview),false);
  await page.waitForTimeout(800);await page.locator('#card').tap();await page.waitForTimeout(delay);await page.locator('#card').tap();assert.equal(await page.evaluate(()=>chosen),2,'Touch double tap selects once');
  await page.evaluate(()=>setDisabled(true));await page.waitForTimeout(20);await page.locator('#card').dblclick();assert.equal(await page.evaluate(()=>chosen),2,'Disabled cards remain blocked');
  await page.close();console.log(`${delay}ms: mouse jitter tolerated, touch selects once, disabled safe`);
 }
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
