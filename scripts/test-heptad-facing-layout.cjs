const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const css=['components/BattleHud.css','components/HeptadArenaBoard.css','app/game/heptad/HeptadClient.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n');
const positions=[[43.5,0],[23,35],[12.5,70],[33.5,70],[63,35],[74.5,70],[53.5,70]];
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const [width,height] of [[3840,2160],[1920,1080],[1366,768],[1024,768],[844,390],[667,375]]){
  const page=await browser.newPage({viewport:{width,height}});
  await page.setContent(`<style>${css}body{margin:0;background:#10151a}.heptad-slot{background:#345}.heptad-slot img{width:100%;height:100%}</style><main class="heptad-scene"><div class="heptad-field"><section class="heptad-arena-board">${[true,false].map(upper=>`<section class="heptad-arena-side" data-upper="${upper}"><div class="heptad-formation">${positions.map(([x,y],i)=>`<button class="heptad-slot" data-turn="${i+1}" style="--slot-x:${x}%;--slot-y:${y}%">${i+1}</button>`).join('')}</div></section>`).join('')}</section></div><section class="nexora-arena-hand"><div class="nexora-arena-hand-heading"><strong>Hand</strong><div class="nexora-arena-hand-filters"><button>All</button></div></div><div class="nexora-arena-hand-cards">${Array.from({length:15},()=>'<button style="background:#567!important">Card</button>').join('')}</div></section></main>`);
  const slots=await page.locator('.heptad-slot').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}));
  const field=await page.locator('.heptad-field').boundingBox(),hand=await page.locator('.nexora-arena-hand').boundingBox();
  assert.equal(hand.height,height<=600?98:width>=2000?220:165,'Hand uses the same desktop/4K/mobile size budget as other modes');
  for(const r of slots)assert.ok(r.x>=field.x-1&&r.y>=field.y-1&&r.x+r.w<=field.x+field.width+1&&r.y+r.h<=field.y+field.height+1,'Every slot fits board');
  assert.ok(slots[0].y>slots[1].y&&slots[7].y<slots[8].y,'Main cards face centre');
  assert.ok(slots[0].y+slots[0].h<slots[7].y,'Main cards cannot overlap');
  assert.ok(field.y+field.height<=hand.y,'Board clears hand');
  const cards=await page.locator('.nexora-arena-hand-cards>button').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {y:r.y,b:r.bottom}}));
  assert.ok(cards.every(r=>r.y>=hand.y&&r.b<=height),'Entire hand cards fit vertically');
  if(width>=3000)assert.ok(cards[0].b-cards[0].y>=150,`4K hand cards remain large enough to inspect: ${JSON.stringify({hand,card:cards[0]})}`);
  await page.locator('.heptad-slot').first().evaluate(node=>{node.dataset.hidden='true';node.innerHTML='<span class="nexora-card-art-frame"><img class="nexora-card-back-art"></span>'});
  assert.equal(await page.locator('.heptad-slot').first().evaluate(node=>getComputedStyle(node).borderTopWidth),'0px','Occupied backs have no extra dark slot border');
  await page.locator('.heptad-slot').first().hover();
  assert.ok((await page.locator('.heptad-slot').first().evaluate(node=>getComputedStyle(node).filter)).includes('drop-shadow'),'Shared mint hover aura is visible');
  fs.mkdirSync('artifacts/heptad-facing',{recursive:true});await page.screenshot({path:`artifacts/heptad-facing/${width}x${height}.png`});await page.close();console.log(`${width}x${height}: 14 slots face centre, no overlap, complete hand height passed`);
 }
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
