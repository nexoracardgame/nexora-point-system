const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),ts=require('typescript');
const env={NOC_META_APP_SECRET:'meta-test',NOC_META_VERIFY_TOKEN:'verify-test',NOC_META_PAGE_ID:'123456789',NOC_FOAM_WEBHOOK_SECRET:'bridge-test'};
const output={},calls=[];let upstream=true;
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/noc-foam-messenger/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports:output,require,Buffer,Response,URL,AbortSignal,process:{env},
  fetch:async(url,options)=>{calls.push({url:String(url),...options});return Response.json({ok:upstream});}
});
const event={object:'page',entry:[{id:env.NOC_META_PAGE_ID,messaging:[{sender:{id:'987654321'},recipient:{id:env.NOC_META_PAGE_ID},timestamp:Date.now(),message:{mid:'m-1',text:'พ่นโฟมราคาเท่าไร 😊'}}]},{id:'other-page',messaging:[]}]};
const sign=body=>{const raw=JSON.stringify(body);return new Request('https://example.test/api/noc-foam-messenger',{method:'POST',body:raw,headers:{'x-hub-signature-256':'sha256='+crypto.createHmac('sha256',env.NOC_META_APP_SECRET).update(raw).digest('hex')}});};
(async()=>{
  assert.equal((await output.GET(new Request('https://example.test?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=123'))).status,403);
  const challenge=await output.GET(new Request('https://example.test?hub.mode=subscribe&hub.verify_token=verify-test&hub.challenge=123'));
  assert.equal(await challenge.text(),'123');assert.equal(challenge.headers.get('cache-control'),'no-store');
  assert.equal((await output.POST(new Request('https://example.test',{method:'POST',body:'{}'}))).status,401);
  assert.equal(calls.length,0);
  assert.equal((await output.POST(sign(null))).status,400);
  assert.equal((await output.POST(sign(event))).status,200);
  const forwarded=JSON.parse(calls[0].body).messengerEnvelope;
  assert.equal(forwarded.signature,crypto.createHmac('sha256',env.NOC_FOAM_WEBHOOK_SECRET).update('noc-messenger-ingress-v1\n'+forwarded.timestamp+'\n'+forwarded.body).digest('hex'));
  assert.ok(!/[^\x00-\x7f]/.test(forwarded.body));assert.equal(JSON.parse(forwarded.body).entry.length,1);
  assert.equal(JSON.parse(forwarded.body).entry[0].messaging[0].message.text,event.entry[0].messaging[0].message.text);
  const count=calls.length;assert.equal((await output.POST(sign({object:'page',entry:[{id:'other-page'}]}))).status,200);assert.equal(calls.length,count);
  upstream=false;assert.equal((await output.POST(sign(event))).status,503,'Failed processing must not claim successful delivery');
  const configuredRequest=sign(event);delete env.NOC_META_APP_SECRET;assert.equal((await output.POST(configuredRequest)).status,503);
  console.log('PASS Messenger ingress: challenge, raw-body signature, page isolation, signed ASCII bridge, fail-closed config and upstream failure. No live requests.');
})().catch(e=>{console.error(e);process.exitCode=1;});
