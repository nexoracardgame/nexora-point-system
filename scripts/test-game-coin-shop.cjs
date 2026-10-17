const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const expected=[[35,70],[99,208],[199,430],[499,1098],[999,2238],[1999,4598]];
const fixture=fs.readFileSync('scripts/test-game-settings-ui.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle='))+'return modules;')(require);
const websiteFixture=fs.readFileSync('scripts/test-game-website.cjs','utf8');const websiteModules=new Function('require',websiteFixture.slice(0,websiteFixture.indexOf('const script='))+'return modules;')(require);Object.assign(modules,websiteModules);
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
modules.shop=compile('components/GameCoinShop.tsx');modules.website=compile('components/GameWebsite.tsx');modules['@/lib/game-coin-packages']=compile('lib/game-coin-packages.ts');modules['./GameCoinShop.css']='';modules['./GameWebsite.css']='';modules['next-auth/react']="exports.useSession=()=>({data:window.guest?null:{user:{id:'coin-ui-test',name:'NEXORA Player'}}});exports.signOut=async()=>{}";modules['next/link']="module.exports={__esModule:true,default:props=>require('react').createElement('a',props)}";
const script=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}const React=require('react');require('react-dom/client').createRoot(document.getElementById('root')).render(React.createElement(require('website').default,null,React.createElement(require('shop').default)));`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 fs.mkdirSync('artifacts/game-coin-shop',{recursive:true});
 for(const [width,height]of [[1920,1080],[1366,768],[844,390],[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height}});const writes=[];
  await page.route('http://coin.test/**',route=>{const url=new URL(route.request().url());if(url.pathname.startsWith('/images/'))return route.fulfill({body:fs.readFileSync('public'+url.pathname),contentType:'image/webp'});if(url.pathname==='/api/game-wallet')return route.fulfill({json:{coin:0,nexPoint:9285}});return route.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><style>body{margin:0}${fs.readFileSync('components/GameWebsite.css','utf8')}${fs.readFileSync('components/GameCoinShop.css','utf8')}</style><div id="root"></div><script>${script}</script>`})});
  page.on('request',request=>{if(request.method()==='POST')writes.push(request.url())});
  await page.goto('http://coin.test/');
  await page.getByRole('heading',{name:'เติม COIN',exact:true}).waitFor();
  await page.locator('.nx-coin-account').getByText('NEXORA Player',{exact:true}).waitFor();
  assert.equal(await page.getByRole('radio').count(),6);assert.equal(await page.locator('.nx-coin-checkout').count(),0);
  for(const [price,total]of expected){
   const format=n=>n.toLocaleString('th-TH');const radio=page.getByRole('radio',{name:`${format(price)} บาท รับ ${format(total)} COIN`,exact:true});await radio.check();
   assert.equal(await page.getByRole('radio',{checked:true}).count(),1);
   const summary=await page.getByRole('region',{name:'สรุปแพ็กที่เลือก'}).innerText();assert.ok(summary.includes(format(price))&&summary.includes(format(total)));
   const pay=page.getByRole('button',{name:'ชำระเงิน',exact:true});const rect=await pay.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width+1&&rect.y+rect.height<=height+1,'Checkout button stays in viewport');
  }
  await page.getByRole('button',{name:'ชำระเงิน',exact:true}).click();await page.getByRole('dialog',{name:'ยังไม่เปิดรับชำระเงิน'}).waitFor();await page.getByRole('button',{name:'ตกลง'}).click();assert.equal(writes.length,0,'No charge or wallet writes before payment integration');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`artifacts/game-coin-shop/${width}.png`,fullPage:true});await page.close();console.log(`${width}x${height}: six exact package rates, exclusive selection, fixed checkout, no premature charge and bounds passed`);
 }
 const guest=await browser.newPage();await guest.route('http://coin.test/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><style>${fs.readFileSync('components/GameCoinShop.css','utf8')}</style><div id="root"></div><script>window.guest=true;${script}</script>`}));await guest.goto('http://coin.test/game/topup?pack=coin-199');await guest.getByRole('radio',{checked:true}).waitFor();await guest.getByRole('button',{name:'เข้าสู่ระบบเพื่อชำระเงิน'}).click();await guest.waitForURL('**/game/login?callbackUrl=*');const callback=new URL(guest.url()).searchParams.get('callbackUrl');assert.equal(callback,'/game/topup?pack=coin-199');console.log('Guest checkout preserves package in login return URL');
 }finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
