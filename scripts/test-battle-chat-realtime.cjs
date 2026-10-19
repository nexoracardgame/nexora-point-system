const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const modules={};for(const[id,pkg,file]of[['react','react','react.production.js'],['react/jsx-runtime','react','react-jsx-runtime.production.js'],['react-dom','react-dom','react-dom.production.js'],['react-dom/client','react-dom','react-dom-client.production.js'],['scheduler','scheduler','scheduler.production.js']])modules[id]=fs.readFileSync(path.join(path.dirname(require.resolve(pkg)),'cjs',file),'utf8');
modules['lucide-react']=fs.readFileSync(require.resolve('lucide-react'),'utf8');
for(const[id,file]of[['chat','components/BattleArenaChat.tsx'],['@/lib/use-battle-chat','lib/use-battle-chat.ts'],['./battle-chat-messages','lib/battle-chat-messages.ts']])modules[id]=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
const app=`const modules=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};new Function('require','module','exports',modules[id])(require,m,m.exports);return m.exports;}const React=require('react');function App(){const[draft,setDraft]=React.useState(''),[messages,setMessages]=React.useState([]),[code,setCode]=React.useState('123456');window.replaceMessages=setMessages;window.changeRoom=setCode;return React.createElement(require('chat').default,{room:{mode:new URLSearchParams(location.search).get('mode'),code},messages,currentUserId:new URLSearchParams(location.search).get('user'),currentUserName:'Player',draft,onDraftChange:setDraft,onSubmit:async()=>{const text=draft;setDraft('');const response=await fetch('/send',{method:'POST',body:JSON.stringify({text,mode:new URLSearchParams(location.search).get('mode'),code})});if(!response.ok){setDraft(text);return false;}const data=await response.json();setMessages(data.messages);return true;}})}require('react-dom/client').createRoot(document.getElementById('root')).render(React.createElement(App));`;
(async()=>{
 let history=[],serial=0,pages=[],fail=false;
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/battle-chat'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({messages:url.searchParams.get('room')==='123456'?history:[]}));}
  if(url.pathname==='/send'){
   let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);
   if(fail){res.writeHead(500);return res.end('{}');}
   history.push({id:'server-'+(++serial),senderId:'a',senderName:'Player',text:body.text.trim().replace(/\s+/g,' '),createdAt:Date.now()});
   for(const page of pages)void page.evaluate(detail=>window.dispatchEvent(new CustomEvent('nexora:battle-chat-changed',{detail})),{mode:body.mode,code:body.code});
   await new Promise(resolve=>setTimeout(resolve,3000));res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({messages:history}));
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<meta charset="utf-8"><style>body{background:#081017;color:white;font:16px Arial}.triad-chat-hud-messages{height:200px;overflow:auto}</style><div id="root"></div><script>${app}</script>`);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const mode of ['triad','pentad'])for(const[width,height]of[[1920,1080],[844,390]]){
   history=[];fail=false;const errors=[];
   const a=await browser.newPage({viewport:{width,height}}),b=await browser.newPage({viewport:{width,height}});pages=[a,b];for(const page of pages)page.on('pageerror',error=>{errors.push(error.message);console.error(error.message)});
   const base=`http://127.0.0.1:${server.address().port}`;await a.goto(`${base}/?mode=${mode}&user=a`);await b.goto(`${base}/?mode=${mode}&user=b`);
   await a.route('**/api/battle-chat?*',async route=>{await new Promise(resolve=>setTimeout(resolve,1000));await route.continue();});
   await a.getByRole('textbox').fill('Instant message');const started=Date.now();await a.getByRole('button',{name:'ส่งข้อความ'}).click();await a.getByText('Instant message',{exact:true}).waitFor({timeout:500});assert.ok(Date.now()-started<750,'Local text does not wait for the three-second POST');
   await b.getByText('Instant message',{exact:true}).waitFor({timeout:1000});assert.ok(Date.now()-started<1500,'Receiver responds to invalidation without room polling');
   await a.evaluate(()=>replaceMessages([]));assert.equal(await a.getByText('Instant message',{exact:true}).count(),1,'Old room snapshots cannot erase pending text');
   await a.waitForTimeout(3200);assert.equal(await a.getByText('Instant message',{exact:true}).count(),1,'HTTP acknowledgement and realtime echo deduplicate');
   await a.getByRole('textbox').fill('Instant message');await a.getByRole('button',{name:'ส่งข้อความ'}).click();await a.waitForTimeout(3200);assert.equal(await a.getByText('Instant message',{exact:true}).count(),2,'Identical consecutive messages remain distinct');
   const newer=Array.from({length:80},(_,i)=>({id:'new-'+i,senderId:'b',senderName:'Other',text:'New '+i,createdAt:Date.now()+i}));history=newer;await a.evaluate(messages=>replaceMessages(messages),newer);await a.waitForTimeout(50);assert.equal(await a.getByText('Instant message',{exact:true}).count(),0,'Acknowledged pending messages never reappear after history truncation');
   fail=true;await a.getByRole('textbox').fill('Failed message');await a.getByRole('button',{name:'ส่งข้อความ'}).click();await a.getByText('· ส่งไม่สำเร็จ',{exact:false}).waitFor();assert.equal(await a.getByRole('textbox').inputValue(),'Failed message');
   await a.evaluate(()=>changeRoom('654321'));await a.waitForTimeout(1200);assert.equal(await a.getByText('Failed message',{exact:true}).count(),0,'Room changes isolate pending messages');
   assert.deepEqual(errors,[]);pages=[];await a.close();await b.close();console.log(`${mode} ${width}x${height}: instant local send, event-driven receiver, slow POST, deduplication, failure and room isolation passed`);
  }
 }finally{pages=[];await browser.close();server.closeAllConnections();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
