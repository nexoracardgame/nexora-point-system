const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const css=['app/globals.css','components/BattleHud.css','components/BattleWaitingRoom.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const [width,height] of [[3840,2160],[1920,1080],[1366,768],[844,390],[667,375]]){
   const page=await browser.newPage({viewport:{width,height}});
   for(const mode of ['triad','pentad','heptad']){
    await page.setContent(`<style>${css}html,body{margin:0;height:100%;background:#080c10}.nexora-shared-waiting{height:calc(100% - 78px)}.nsw-avatar{background:#765;border-radius:50%}</style><div style="height:78px"></div><section class="nexora-shared-waiting" data-mode="${mode}"><div class="nsw-seats">${['A','B'].map(name=>`<article class="nsw-seat"><small>${name}</small><div class="nsw-person"><div class="nsw-avatar"></div><strong>Player ${name}</strong><span>Ready</span><div class="nsw-seat-actions"></div></div></article>`).join('')}<div class="nsw-chat-row"><div class="nsw-chat"><section class="triad-battle-chat-hud"><div class="triad-chat-hud-messages"></div><form><input placeholder="Chat"><button>Send</button></form></section></div></div></div><section class="nsw-settings">Room mode</section><div class="nsw-footer">Spectators</div></section>`);
    const profiles=page.locator('.nsw-person');
    const before=await profiles.evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}));
    const chatBefore=await page.locator('.nsw-chat').boundingBox();
    for(const count of [1,5,30,80]){
     await page.locator('.triad-chat-hud-messages').evaluate((node,count)=>{node.replaceChildren(...Array.from({length:count},(_,i)=>{const row=document.createElement('div');row.className='triad-chat-hud-line';row.textContent='Player: '+i+' message';return row}));node.scrollTop=node.scrollHeight},count);
     const after=await profiles.evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}));
     assert.deepEqual(after,before,`${mode} ${width}: profile cannot move as chat grows`);
     assert.deepEqual(await page.locator('.nsw-chat').boundingBox(),chatBefore,'Chat frame also stays fixed');
    }
    assert.ok(chatBefore.y>=before[0].y+before[0].height-1,'Chat and profile areas do not overlap');
    assert.ok(chatBefore.y+chatBefore.height<=height,'Chat fits landscape viewport');
   }
   fs.mkdirSync('artifacts/chat-stability',{recursive:true});
   await page.screenshot({path:`artifacts/chat-stability/waiting-${width}x${height}.png`});
   await page.close();console.log(`${width}x${height}: all 3 modes, 0-80 messages, fixed profiles and chat bounds passed`);
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
