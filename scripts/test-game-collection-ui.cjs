const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-settings-ui.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle='))+'return modules;')(require);
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
for(const [id,file]of [['collection','components/GameCardCollection.tsx'],['./GameBackControl','components/GameBackControl.tsx'],['./GamePageLogo','components/GamePageLogo.tsx'],['@/lib/game-collection-client','lib/game-collection-client.ts'],['@/lib/game-collection','lib/game-collection.ts'],['@/lib/triad-dominion','lib/triad-dominion.ts'],['@/lib/use-card-gesture','lib/use-card-gesture.ts'],['./triad-deck-rules','lib/triad-deck-rules.ts'],['./pentad-dominion','lib/pentad-dominion.ts']])modules[id]=compile(fs.readFileSync(file,'utf8'));
for(const id of ['./GameCardCollection.css','./GamePageLogo.css'])modules[id]='';
for(const [id,target]of [['./triad-dominion','@/lib/triad-dominion'],['./game-collection','@/lib/game-collection']])modules[id]=`module.exports=require(${JSON.stringify(target)});`;
modules['@/public/cards/card-skill-db.json']='module.exports='+fs.readFileSync('public/cards/card-skill-db.json','utf8');
modules['next-auth/react']='exports.useSession=()=>({status:"authenticated",data:{user:{id:"qa-owner",name:"QA"}}});';
modules['next/image']='exports.__esModule=true;exports.default=p=>require("react").createElement("img",p);exports.getImageProps=p=>({props:p});';
modules['@/lib/game-ui-audio']='exports.playGameUiSound=()=>{};';
const script=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}require('react-dom/client').createRoot(document.getElementById('root')).render(require('react').createElement(require('collection').default));`;
const css=['GameShell.css','GamePageLogo.css','GameCardCollection.css'].map(file=>fs.readFileSync('components/'+file,'utf8')).join('\n');
const core=require('./game-collection-test-loader.cjs')(),{triadCards}=core('lib/triad-dominion.ts'),rules=core('lib/game-collection.ts');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});fs.mkdirSync('artifacts/game-collection',{recursive:true});try{
 for(const [width,height]of [[1920,1080],[1366,768],[844,390],[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[],posts=[];let fail=false;
  page.on('pageerror',error=>errors.push(error.message));
  const owned=triadCards.filter(card=>card.kind!=='unknown').slice(0,30).map(card=>({cardNo:card.cardNo,quantity:2,favorite:false,acquiredAt:new Date().toISOString()})),firstNo=owned[0].cardNo;
  let snapshot={owned,decks:[{id:'deck-a',name:'เด็คทดสอบ',format:'triad-all',cards:rules.emptyDeckCards(),version:1,updatedAt:new Date().toISOString()}],wallet:{nexPoint:2480,coin:25}};
  await page.route('http://collection.test/**',async route=>{const url=new URL(route.request().url());if(url.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><style>body{margin:0}${css}</style><div class="nexora-game-platform"><button id="open" onclick="window.dispatchEvent(new Event('nexora:open-game-collection'))">OPEN</button><div id="root"></div></div><script>${script}</script>`});
   if(url.pathname==='/api/game-collection'){
    if(fail)return route.fulfill({status:503,json:{error:'QA network unavailable'}});
    if(route.request().method()==='GET')return route.fulfill({json:snapshot});
    const body=route.request().postDataJSON();posts.push(body);
    if(body.action==='favorite'){snapshot.owned.find(card=>card.cardNo===body.cardNo).favorite=body.favorite;return route.fulfill({json:{ok:true}})}
    if(body.action==='delete'){snapshot.decks=snapshot.decks.filter(deck=>deck.id!==body.id);return route.fulfill({json:{ok:true}})}
    if(body.action==='save'){const problems=rules.validateCollectionDeck(body.format,body.cards,snapshot.owned,true);if(problems.length)return route.fulfill({status:422,json:{error:problems.join('\n')}});const old=snapshot.decks.find(deck=>deck.id===body.id);if(old&&old.version!==body.version)return route.fulfill({status:409,json:{error:'Conflict'}});const deck={id:body.id||'deck-'+posts.length,name:body.name,format:body.format,cards:body.cards,version:(old?.version||0)+1,updatedAt:new Date().toISOString()};snapshot.decks=[deck,...snapshot.decks.filter(item=>item.id!==deck.id)];return route.fulfill({json:{deck}})}
    return route.fulfill({status:400,json:{error:'Invalid action'}});
   }
   const file=path.join('public',url.pathname);return fs.existsSync(file)?route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.png')?'image/png':file.endsWith('.jpg')?'image/jpeg':'image/webp'}):route.abort();
  });
  await page.goto('http://collection.test/');await page.waitForFunction(()=>Boolean(require('@/lib/game-collection-client').cachedGameCollection('qa-owner')));await page.locator('#open').click();
  const panel=page.getByRole('dialog',{name:'การ์ดของฉัน',exact:true});await panel.waitFor();assert.equal(await panel.locator('.gcc-card').count(),24);
  await panel.getByRole('textbox',{name:'ค้นหาการ์ด'}).fill(firstNo);await panel.getByRole('button',{name:'รายการโปรด '+firstNo,exact:true}).click();await page.waitForFunction(no=>require('@/lib/game-collection-client').cachedGameCollection('qa-owner').owned.find(card=>card.cardNo===no).favorite,firstNo);
  await panel.locator('.gcc-deck-item').first().click();if(width<=1000)await panel.getByRole('button',{name:'พับเด็ค',exact:true}).click();
  const add=panel.getByRole('button',{name:'เพิ่มการ์ด '+firstNo,exact:true});await add.click();await add.click();assert.equal(await add.isDisabled(),true,'Cannot add more copies than owned');
  if(width<=1000)await panel.locator('.gcc-mobile-deck').click();
  await panel.getByRole('textbox',{name:'ชื่อเด็ค',exact:true}).fill('บันทึกเด็คทดสอบ');await panel.getByRole('button',{name:'บันทึกเด็ค',exact:true}).click();await page.waitForFunction(()=>require('@/lib/game-collection-client').cachedGameCollection('qa-owner').decks[0].cards.main.length===2);assert.equal(snapshot.decks[0].name,'บันทึกเด็คทดสอบ');
  if(width<=1000)await panel.getByRole('button',{name:'พับเด็ค',exact:true}).click();
  const face=panel.locator('.gcc-card-face').first();
  if(width===1920){const from=await panel.locator('h1').boundingBox(),to=await face.boundingBox();await page.mouse.move(from.x+5,from.y+5);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2);await panel.locator('.gcc-inspect').waitFor();await page.mouse.up();await panel.locator('.gcc-inspect').waitFor({state:'detached'});}
  if(width===390){await face.dispatchEvent('pointerdown',{pointerType:'touch',pointerId:7,button:0,clientX:20,clientY:20});await page.waitForTimeout(2600);await panel.locator('.gcc-inspect').waitFor();await face.dispatchEvent('pointerup',{pointerType:'touch',pointerId:7,button:0});await panel.locator('.gcc-inspect').waitFor({state:'detached'});}
  await panel.getByRole('textbox',{name:'ค้นหาการ์ด'}).fill('');await page.waitForTimeout(250);await page.screenshot({path:`artifacts/game-collection/${width}.png`});
  for(const selector of ['.gcc-header','.gcc-toolbar','.gcc-pagination']){const rect=await panel.locator(selector).boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width+1&&rect.y+rect.height<=height+1,selector+' fits '+width+JSON.stringify(rect))}
  assert.equal(await panel.evaluate(element=>element.scrollWidth>element.clientWidth+1),false,'No horizontal page overflow');
  if(width<=1000)await panel.locator('.gcc-mobile-deck').click();await panel.getByRole('textbox',{name:'ชื่อเด็ค',exact:true}).fill('UNSAVED');await panel.getByRole('button',{name:'ย้อนกลับ',exact:true}).click();await panel.getByRole('alertdialog').getByRole('button',{name:'ยกเลิก',exact:true}).click();assert.equal(await panel.getByRole('textbox',{name:'ชื่อเด็ค',exact:true}).inputValue(),'UNSAVED');await panel.getByRole('button',{name:'ย้อนกลับ',exact:true}).click();await panel.getByRole('alertdialog').getByRole('button',{name:'ยืนยัน',exact:true}).click();await panel.waitFor({state:'detached'});await page.locator('#open').click();await panel.waitFor();assert.equal(await panel.getByRole('textbox',{name:'ชื่อเด็ค',exact:true}).inputValue(),'บันทึกเด็คทดสอบ','Discard restores saved deck');if(width<=1000)await panel.getByRole('button',{name:'พับเด็ค',exact:true}).click();
  await panel.getByRole('button',{name:'สร้างเด็คใหม่',exact:true}).click();const modal=panel.getByRole('alertdialog');await modal.getByRole('textbox').fill('PENTAD draft');await modal.getByRole('combobox').selectOption('pentad');await modal.getByRole('button',{name:'สร้างเด็ค',exact:true}).click();await panel.getByRole('button',{name:'บันทึกเด็ค',exact:true}).click();await page.waitForFunction(()=>require('@/lib/game-collection-client').cachedGameCollection('qa-owner').decks[0].format==='pentad');
  await panel.getByRole('button',{name:'ลบเด็ค',exact:true}).click();await panel.getByRole('alertdialog').getByRole('button',{name:'ยืนยัน',exact:true}).click();await page.waitForFunction(()=>require('@/lib/game-collection-client').cachedGameCollection('qa-owner').decks.length===1);assert.equal(snapshot.owned[0].quantity,2);
  await panel.getByRole('button',{name:/อัลบั้มการ์ด/}).click();await panel.getByRole('textbox',{name:'ค้นหาการ์ด'}).fill('no-card-matches-999');await panel.getByRole('heading',{name:'ไม่พบการ์ดที่ตรงกัน'}).waitFor();
  await panel.getByRole('button',{name:'ย้อนกลับ',exact:true}).click();await panel.waitFor({state:'detached'});assert.deepEqual(errors,[]);assert.ok(posts.every(post=>['save','delete','favorite'].includes(post.action)),'No economic mutations');
  if(width===320){snapshot={...snapshot,owned:[],decks:[]};await page.locator('#open').click();await panel.getByRole('textbox',{name:'ค้นหาการ์ด'}).fill('');await panel.getByRole('button',{name:/เป็นเจ้าของ/}).click();await panel.getByRole('button',{name:'อัปเดตคลังการ์ด'}).click();await panel.getByRole('heading',{name:'ยังไม่มีการ์ดถาวรในคลัง'}).waitFor();await panel.getByRole('button',{name:'ดูอัลบั้มการ์ด'}).click();assert.equal(await panel.locator('.gcc-card[data-owned=false]').count(),24);assert.equal(await panel.locator('.gcc-card-add').count(),0);}
  console.log(`Collection UI ${width}x${height}: filters, favorite, ownership limits, saved TRIAD/PENTAD drafts, delete, preview, responsive bounds and close passed`);await page.close();
 }
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
