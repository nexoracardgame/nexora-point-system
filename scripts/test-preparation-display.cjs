const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const video=ts.transpileModule(fs.readFileSync('lib/preparation-video.ts','utf8'),{compilerOptions:{module:1,target:9}}).outputText;
const css=['app/globals.css','components/BattleHud.css','components/BattleWaitingRoom.css','components/BattleArenaChat.css'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const [width,height] of [[3840,2160],[1920,1080],[844,390]]){
 const page=await browser.newPage({viewport:{width,height}});
 await page.setContent(`<style>${css}body{margin:0}.nexora-deck-catalog{height:70vh;width:70vw}.nexora-deck-grid>button{padding:0}.nsw-chat{position:fixed;bottom:0}</style><div class="nexora-deck-catalog"><div class="nexora-deck-grid">${'<button><div>Card</div><div>Name</div></button>'.repeat(300)}</div></div><div class="nsw-chat"><section class="triad-battle-chat-hud" data-chat-expanded="false"><div class="triad-chat-hud-messages"></div><form><input></form></section></div><div id="a"></div><div id="b"></div>`);
 const bounds=await page.locator('.nexora-deck-grid>button').first().boundingBox();assert.ok(bounds.height>bounds.width,'Deck cards cannot collapse into strips');assert.ok(await page.locator('.nexora-deck-grid').evaluate(n=>n.scrollHeight>n.clientHeight),'Catalog scrolls rather than squeezing rows');
 const chat=page.locator('.triad-battle-chat-hud'),before=await chat.boundingBox();assert.equal(await chat.evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)');await chat.evaluate(n=>n.dataset.chatExpanded='true');assert.deepEqual(await chat.boundingBox(),before);
 await page.addScriptTag({content:`const module={exports:{}};const exports=module.exports;function require(){return {homeWallpaperSources:()=>['/loop.mp4'],loadHomeWallpaper:()=>new Promise(()=>{})}};${video};window.v=module.exports;`});
 const continuity=await page.evaluate(()=>{window.v.warmPreparationVideo();const first=document.querySelector('video');const a=document.getElementById('a'),b=document.getElementById('b');const detach=window.v.attachPreparationVideo(a);detach();const stop=window.v.attachPreparationVideo(b);const same=first===b.querySelector('video');stop();return {same,count:document.querySelectorAll('video').length}});assert.deepEqual(continuity,{same:true,count:1});await page.close();console.log(`${width}: full card ratio, scrollable catalog, hidden idle chat and single persistent video passed`);
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
