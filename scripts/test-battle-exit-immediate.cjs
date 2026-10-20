const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-waiting-profile-frames.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const css='))+'return modules;')(require);
modules.navigation=ts.transpileModule(fs.readFileSync('lib/battle-lobby-navigation.ts','utf8'),{compilerOptions:{module:1,target:9}}).outputText;
const script=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports;}const R=require('react'),nav=require('navigation');window.routeCalls=0;function App(){const [battle,setBattle]=R.useState(true);window.leave=async()=>{await Promise.resolve(true);if(window.mode==='triad')nav.commitBattleExit(()=>setBattle(false));else nav.returnToBattleLobby({replace:()=>window.routeCalls++},()=>setBattle(false));window.lobbyAtReturn=document.getElementById('lobby')!==null;void new Promise(()=>{});};return R.createElement('main',{id:battle?'battle':'lobby'},battle?'Battle':'Lobby')}require('react-dom/client').createRoot(document.getElementById('root')).render(R.createElement(App));`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const mode of ['triad','pentad','heptad']){
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<div id="root"></div>');await page.addScriptTag({content:script});await page.locator('#battle').waitFor();
  const result=await page.evaluate(async mode=>{window.mode=mode;await window.leave();return {immediate:window.lobbyAtReturn,routes:window.routeCalls,battle:!!document.getElementById('battle')};},mode);
  assert.deepEqual(result,{immediate:true,routes:0,battle:false});assert.deepEqual(errors,[]);await page.close();console.log(`${mode}: lobby committed before exit handler returns, no route wait, pending network cannot block`);
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
