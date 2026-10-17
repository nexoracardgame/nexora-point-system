const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=fs.readFileSync('scripts/test-game-settings-ui.cjs','utf8');
const modules=new Function('require',fixture.slice(0,fixture.indexOf('const bundle='))+'return modules;')(require);
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
modules['next/navigation']='exports.useParams=()=>({id:window.playerId});exports.useRouter=()=>window.router;';
modules['next-auth/react']='exports.useSession=()=>({data:{user:{id:"self",name:"Stale session name"}},status:"authenticated"});';
modules['@/components/GamePlayerProfile']='exports.__esModule=true;exports.default=p=>require("react").createElement("main",{"data-id":p.user.id},p.user.name+" "+p.rank.name);';
modules['@/lib/game-profile-client']=transpile(fs.readFileSync('lib/game-profile-client.ts','utf8'));
modules.other=transpile(fs.readFileSync('app/game/profile/[id]/page.tsx','utf8'));
modules.own=transpile(fs.readFileSync('app/game/profile/page.tsx','utf8'));
const script=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports}window.playerId='a';window.router={replace:()=>{}};window.requests=[];window.fetch=url=>new Promise(resolve=>requests.push({url,resolve}));require('@/lib/game-profile-client').primeGameIdentity('a','Identity only','/a.png');const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root'));window.kind='other';window.render=()=>root.render(React.createElement(require(window.kind).default));window.complete=(id,name)=>requests.find(r=>r.url.endsWith('='+id)).resolve({ok:true,json:async()=>({user:{id,name,image:'/avatar.png'},appearance:{avatar:'',frame:'gold',hero:'gold'},available:true,stats:{wins:1,losses:0},rank:{name:'Bronze',nextWins:10,nextName:'Silver'}})});render();`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const viewport of [{width:1920,height:1080},{width:390,height:844}]){
  const page=await browser.newPage({viewport});await page.setContent('<div id="root"></div>');await page.addScriptTag({content:script});
  await page.waitForFunction(()=>requests.length===1);assert.equal(await page.locator('main').count(),0,'Direct route must not render a placeholder');
  await page.evaluate(()=>{window.playerId='b';render()});await page.waitForFunction(()=>requests.length===2);
  await page.evaluate(()=>complete('a','Alice'));await page.waitForTimeout(50);assert.equal(await page.locator('main').count(),0,'Stale response must not show another player');
  await page.evaluate(()=>complete('b','Bob'));await page.getByText('Bob Bronze',{exact:true}).waitFor();
  await page.evaluate(()=>{window.playerId='a';render()});await page.getByText('Alice Bronze',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>requests.length),2);
  await page.evaluate(()=>{window.kind='own';render()});await page.waitForFunction(()=>requests.length===3);assert.equal(await page.locator('main').count(),0,'Own route must not use stale session identity');
  await page.evaluate(()=>complete('self','Actual own name'));await page.getByText('Actual own name Bronze',{exact:true}).waitFor();
  console.log(`Direct profiles ${viewport.width}: complete data, isolated identities, cached reopen and actual own identity passed`);await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
