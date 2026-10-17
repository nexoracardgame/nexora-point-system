const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const modules={};
for(const [id,pkg,file]of [['react','react','react.production.js'],['react/jsx-runtime','react','react-jsx-runtime.production.js'],['react-dom','react-dom','react-dom.production.js'],['react-dom/client','react-dom','react-dom-client.production.js'],['scheduler','scheduler','scheduler.production.js']])modules[id]=fs.readFileSync(path.join(path.dirname(require.resolve(pkg)),'cjs',file),'utf8');
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
modules['lucide-react']=fs.readFileSync(require.resolve('lucide-react'),'utf8');
for(const file of ['card-skill-db','card-art'])modules['@/public/cards/'+file+'.json']='module.exports='+fs.readFileSync('public/cards/'+file+'.json','utf8');
for(const name of ['triad-dominion','game-card-art','game-monsters']){modules['@/lib/'+name]=transpile(fs.readFileSync('lib/'+name+'.ts','utf8'));modules['./'+name]='module.exports=require("@/lib/'+name+'");'}
modules['@/lib/game-ui-audio']='exports.playGameUiSound=()=>{};';
for(const name of ['GameBackControl','GamePageLogo','GameMonsterCodex'])modules['./'+name]=transpile(fs.readFileSync('components/'+name+'.tsx','utf8'));
modules['./GamePageLogo.css']=' ';modules['./GameMonsterCodex.css']=' ';
const bundle=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;if(!modules[id])throw Error('Missing module '+id);const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}window.monsters=require('@/lib/game-monsters').gameMonsters;require('react-dom/client').createRoot(document.getElementById('root')).render(require('react').createElement(require('./GameMonsterCodex').default));`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 fs.mkdirSync('artifacts/game-monsters',{recursive:true});
 for(const [width,height]of [[1920,1080],[1366,768],[844,390],[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
  await page.route('http://monsters.test/**',async r=>{const u=new URL(r.request().url());if(u.pathname==='/'){return r.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><style>body{margin:0;font-family:Arial,sans-serif}button,input,select{font:inherit}${fs.readFileSync('components/GamePageLogo.css','utf8')}${fs.readFileSync('components/GameMonsterCodex.css','utf8')}</style><button id="opener" onclick="window.dispatchEvent(new Event('nexora:open-monsters'))">Open</button><div id="root"></div><script>${bundle.replaceAll('</script','<\\/script')}</script>`})}const file=path.join(process.cwd(),'public',decodeURIComponent(u.pathname));assert.ok(fs.existsSync(file),'Missing resource '+u.pathname);return r.fulfill({path:file})});
  await page.goto('http://monsters.test/');await page.waitForFunction(()=>window.monsters);await page.waitForTimeout(100);await page.locator('#opener').click();await page.getByRole('dialog').waitFor();
  const cards=await page.evaluate(()=>window.monsters);assert.ok(cards.length>100);assert.equal(await page.locator('[data-monster]').count(),cards.length);
  await page.getByRole('combobox',{name:'ธาตุมอนสเตอร์'}).selectOption('fire');assert.equal(await page.locator('[data-monster]').count(),cards.filter(c=>c.element==='fire').length);await page.getByRole('combobox',{name:'ธาตุมอนสเตอร์'}).selectOption('all');
  await page.getByRole('textbox',{name:'ค้นหามอนสเตอร์'}).fill('no-such-monster');await page.getByRole('button',{name:'ล้างตัวกรอง'}).click();assert.equal(await page.locator('[data-monster]').count(),cards.length);
  await page.screenshot({path:`artifacts/game-monsters/album-${width}.png`});
  const check=width===1366&&!process.argv.includes('--quick')?cards:[cards[0],cards.at(-1)];
  for(const card of check){await page.locator(`[data-monster="${card.cardNo}"]`).click();await page.locator('.gmc-character-info h2').waitFor();assert.equal(await page.locator('.gmc-character-info h2').textContent(),card.name);assert.ok((await page.locator('.gmc-stats').textContent()).includes(card.attack.toLocaleString('en-US')));await page.getByRole('button',{name:'มอนสเตอร์ทั้งหมด',exact:true}).click();}
  await page.locator('[data-monster]').first().click();await page.waitForTimeout(300);await page.screenshot({path:`artifacts/game-monsters/detail-${width}.png`});
  assert.ok(await page.locator('.gmc-character-full').evaluate(i=>i.complete&&i.naturalWidth>0));
  const bounds=await page.getByRole('dialog').boundingBox();assert.equal(bounds.x,0);assert.equal(bounds.y,0);assert.equal(bounds.width,width);assert.equal(bounds.height,height);
  assert.equal(await page.locator('.game-monster-codex').evaluate(e=>e.scrollWidth>e.clientWidth),false);
  await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.gmc-character-info h2').textContent(),cards[1].name);await page.keyboard.press('Escape');await page.locator('.gmc-grid').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});await page.waitForFunction(()=>document.activeElement.id==='opener');assert.deepEqual(errors,[]);
  console.log(`${width}x${height}: ${cards.length} monsters, filters, ${check.length} details, image, navigation, bounds and focus passed`);await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
