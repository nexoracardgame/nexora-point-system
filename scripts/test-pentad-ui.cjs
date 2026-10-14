const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict'),vm=require('node:vm');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const transpile=(code,fileName='file.tsx')=>ts.transpileModule(code,{fileName,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const modules={};
for(const [id,pkg,file] of [['react','react','react.production.js'],['react/jsx-runtime','react','react-jsx-runtime.production.js'],['react-dom','react-dom','react-dom.production.js'],['react-dom/client','react-dom','react-dom-client.production.js'],['scheduler','scheduler','scheduler.production.js']]) modules[id]=fs.readFileSync(path.join(path.dirname(require.resolve(pkg)),'cjs',file),'utf8');
modules['lucide-react']=fs.readFileSync(require.resolve('lucide-react'),'utf8');
modules['next/link']=`const React=require('react');exports.default=({href,children,...props})=>React.createElement('a',{href,...props},children);exports.__esModule=true;`;
modules['@/lib/supabase-browser']='exports.getBrowserSupabaseClient=()=>null;';
modules['../triad-dominion/BattleAudio']=modules['./BattleAudio']='exports.primeBattleAudio=async()=>false;exports.playMenuCue=()=>{};exports.battleAudioReady=()=>false;exports.playBattleSequence=()=>()=>{};';
modules['@/public/cards/card-skill-db.json']='module.exports='+JSON.stringify(require('../public/cards/card-skill-db.json'))+';';
for(const [id,file] of [ ['@/lib/triad-dominion','lib/triad-dominion.ts'],['@/lib/pentad-dominion','lib/pentad-dominion.ts'],['@/lib/triad-arena','lib/triad-arena.ts'],['./BattleTiming','app/(main)/battle/triad-dominion/BattleTiming.ts'],['./BattleParticles','app/(main)/battle/triad-dominion/BattleParticles.tsx'],['../triad-dominion/BattleCinematic','app/(main)/battle/triad-dominion/BattleCinematic.tsx'],['client','app/(main)/battle/pentad-dominion/PentadDominionClient.tsx']])modules[id]=transpile(fs.readFileSync(id==='../triad-dominion/BattleCinematic'&&process.env.PENTAD_CINEMATIC_SOURCE?process.env.PENTAD_CINEMATIC_SOURCE:file,'utf8'),file);
modules['./triad-dominion']=modules['@/lib/triad-dominion'];
let css='';
for(const [id,file,prefix] of [['./PentadDominion.module.css','app/(main)/battle/pentad-dominion/PentadDominion.module.css','penta_'],['./BattleCinematic.module.css','app/(main)/battle/triad-dominion/BattleCinematic.module.css','cine_']]) {
  css+=fs.readFileSync(file,'utf8').replace(/\.([a-zA-Z_][\w-]*)/g,(_,name)=>'.'+prefix+name)+'\n';
  modules[id]=`exports.__esModule=true;exports.default=new Proxy({},{get:(_,name)=>${JSON.stringify(prefix)}+name});`;
}
const bundle=Object.entries(modules).map(([id,code])=>`${JSON.stringify(id)}:function(require,module,exports){${code}\n}`).join(',');
const html=`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}button,input,select{font:inherit;color:inherit}button{border:0;background:none}a{color:inherit;text-decoration:none}${css}</style></head><body><div id="root"></div><script>const modules={${bundle}},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};if(!modules[id])throw Error('Missing module '+id);modules[id](require,m,m.exports);return m.exports;}require('react-dom/client').createRoot(document.getElementById('root')).render(require('react').createElement(require('client').default,{userId:'a'}));</script></body></html>`;
const nodeCache={};function load(file){if(nodeCache[file])return nodeCache[file].exports;const module=nodeCache[file]={exports:{}};const localRequire=id=>id==='./prisma'?{prisma:{}}:id==='@/public/cards/card-skill-db.json'?require('../public/cards/card-skill-db.json'):id.startsWith('./')?load('lib/'+id.slice(2)+'.ts'):require(id);vm.runInThisContext(`(function(require,module,exports){${transpile(fs.readFileSync(file,'utf8'),file)}\n})`,{filename:file})(localRequire,module,module.exports);return module.exports;}
const store=load('lib/pentad-room-store.ts'),rules=load('lib/pentad-dominion.ts');
const actor={id:'a',name:'ผู้เล่นทดสอบ',image:'/avatar.png'},rival={id:'b',name:'คู่ต่อสู้',image:'/avatar.png'};
let room=null,serialVersion=10000;
function preparation(){room=store.newPentadRoom('123456',actor);room.seats.challenger=rival;room.phase='deck';room.epoch=1;room.deadline=Date.now()+600000;return room;}
function battle(){preparation();room.phase='select';room.epoch=2;room.decks.host=rules.completePentadDeck(rules.emptyPentadDeck());room.decks.challenger=rules.completePentadDeck(rules.emptyPentadDeck());room.ready={host:true,challenger:true};room.board={host:['021','001','003','004','005'],challenger:['099','002','016','017','018']};room.turn=2;room.picks={host:'',challenger:''};room.deadline=Date.now()+120000;return room;}
const inside=(rect,w,h)=>rect&&rect.x>=-1&&rect.y>=-1&&rect.x+rect.width<=w+1&&rect.y+rect.height<=h+1;
(async()=>{
  fs.mkdirSync('artifacts/pentad-ui',{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
  try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://pentad.test/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.startsWith('/api/')) {
      try{
        if(route.request().method()==='POST') {
          const body=route.request().postDataJSON();
          if(body.action==='create')room=store.newPentadRoom('123456',actor);
          else {store.applyPentadAction(room,actor,body);store.tickPentadRoom(room);}
          if(body.action==='leave'){room=null;return route.fulfill({json:{}})}
        } else if(url.searchParams.has('room'))store.tickPentadRoom(room);
        return route.fulfill({json:room?{room:store.publicPentadRoom({...room,version:++serialVersion},actor.id)}:{rooms:[]}});
      }catch(e){return route.fulfill({status:409,json:{error:e.message}})}
    }
    if(url.pathname==='/')return route.fulfill({body:html,contentType:'text/html'});
    const asset=path.resolve('public','.'+url.pathname);if(!asset.startsWith(path.resolve('public')+path.sep)||!fs.existsSync(asset))return route.abort();
    return route.fulfill({body:fs.readFileSync(asset),contentType:asset.endsWith('.webp')?'image/webp':asset.endsWith('.png')?'image/png':'image/jpeg'});
  });
  const sync=async()=>{room.version+=100;await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForTimeout(120);};
  for(const [width,height] of [[3840,2160],[1920,1080],[1280,720],[1024,768],[844,390],[667,375],[390,844],[320,568]]) {
    room=null;await page.setViewportSize({width,height});await page.goto('https://pentad.test/');await page.getByRole('button',{name:/สร้างห้อง/}).waitFor();
    await page.getByRole('button',{name:/สร้างห้อง/}).click();await page.waitForSelector('[data-pentad-phase="waiting"]');
    await page.getByRole('button',{name:'เพิ่มบอท'}).click();await page.getByRole('button',{name:'เริ่มเกม'}).click();await page.waitForSelector('[data-pentad-phase="deck"]');
    await page.getByRole('button',{name:'เติมเด็ค'}).click();await page.getByRole('button',{name:'พร้อม',exact:true}).waitFor();
    await page.getByRole('button',{name:'พร้อม',exact:true}).click();await page.waitForSelector('[data-pentad-phase="select"]');
    for(const button of await page.locator('.penta_header button,.penta_chat input').all())assert.ok(inside(await button.boundingBox(),width,height),'Controls fit '+width);
    await page.screenshot({path:`artifacts/pentad-ui/battle-${width}x${height}.png`});
    assert.equal(await page.locator('.penta_formation .penta_card').count(),10);
    const boardCards=await page.locator('.penta_formation .penta_card').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,ratio:e.clientWidth/e.clientHeight}}));
    for(const card of boardCards){assert.ok(inside(card,width,height),'All ten cards fit '+width);assert.ok(Math.abs(card.ratio-815/1110)<.025,'Native ratio preserved');}
    for(let i=0;i<boardCards.length;i++)for(let j=i+1;j<boardCards.length;j++){const a=boardCards[i],b=boardCards[j];const overlap=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>2&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>2;assert.equal(overlap,false,`Cards ${i}/${j} must not overlap at ${width}`);}
    preparation();room.version+=500;await sync();await page.waitForSelector('[data-pentad-phase="deck"]');await page.screenshot({path:`artifacts/pentad-ui/deck-${width}x${height}.png`});
    for(const control of await page.locator('.penta_deckActions button,.penta_tabs button').all())assert.ok(inside(await control.boundingBox(),width,height),'Deck controls fit '+width);
    battle();room.phase='target';room.choices=[{side:'host',cardNo:'225',options:['player-top'],value:'',deadline:Date.now()+30000}];await sync();await page.waitForSelector('.penta_choiceOverlay');await page.screenshot({path:`artifacts/pentad-ui/target-${width}x${height}.png`});
    assert.ok(inside(await page.locator('.penta_choicePanel').boundingBox(),width,height),'Target overlay fits '+width);
    console.log('Pentad UI '+width+'x'+height+': create/bot/start/ready, ten cards, native ratios, deck and target controls passed');
  }
  await page.setViewportSize({width:1280,height:720});battle();room.phase='target';room.choices=[{side:'host',cardNo:'232',options:['player-top>bot-top','bot-top>player-top'],value:'',deadline:Date.now()+30000}];await sync();assert.equal(await page.locator('.penta_sequenceChoice').count(),2);
  battle();const result=rules.resolvePentadTurn({fight:1,turn:2,mains:{host:'021',challenger:'099'},skills:{host:'001',challenger:'002'},opener:'host'});room.phase='result';room.rounds=[{...result,id:1,fight:1,turn:2,mains:{host:'021',challenger:'099'},skills:{host:'001',challenger:'002'},opener:'host',endsAt:Date.now()+25000,finalDuel:false}];room.deadline=room.rounds[0].endsAt;
  const draft='พิมพ์ระหว่างการต่อสู้';await page.getByRole('textbox',{name:'ข้อความแชท'}).fill(draft);await sync();await page.waitForSelector('.cine_overlay');assert.equal(await page.getByRole('textbox',{name:'ข้อความแชท'}).inputValue(),draft);await page.getByRole('textbox',{name:'ข้อความแชท'}).fill(draft+'ได้');await page.getByRole('button',{name:'ส่งข้อความ'}).click();await page.getByText(draft+'ได้',{exact:false}).waitFor();await page.screenshot({path:'artifacts/pentad-ui/cinematic-chat.png'});
  assert.deepEqual(errors,[]);console.log('Pentad UI: ordered transfer choice, live chat through shared cinematic, no browser errors passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
