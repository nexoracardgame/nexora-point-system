const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('typescript'),{EventEmitter}=require('node:events');
const transpile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const library={},output={},calls=[],logs=[];
const app='2146587072887497',page='408021709324004',token='test-page-token-'.repeat(8),appSecret='a'.repeat(32);
let mode='',subscriptionData=[];
const valid={is_valid:true,app_id:app,type:'PAGE',profile_id:page,expires_at:0,scopes:['pages_messaging','pages_manage_metadata','pages_read_engagement'],granular_scopes:[{scope:'pages_messaging',target_ids:[page]}]};
function mockRequest(options,callback){
  calls.push(options);const req=new EventEmitter();req.setTimeout=()=>req;req.destroy=e=>{queueMicrotask(()=>req.emit('error',e));return req;};
  req.end=()=>queueMicrotask(()=>{
    if(mode==='network'){req.emit('error',Error(token+appSecret));return;}
    const response=new EventEmitter();response.statusCode=mode==='denied'?400:mode==='redirect'?302:200;callback(response);
    const payload=mode==='denied'?{error:{code:100,error_subcode:0,message:token+appSecret}}:{data:options.path.endsWith('/subscriptions')?subscriptionData:valid};
    response.emit('data',Buffer.from(mode==='invalid-json'?token:mode==='oversized'?'x'.repeat(70000):JSON.stringify(payload)));response.emit('end');
  });return req;
}
vm.runInNewContext(transpile('lib/noc-messenger-token-check.ts'),{exports:library,Buffer,AbortSignal,require:name=>name==='node:https'?{request:mockRequest}:require(name)});
const env={NOC_FOAM_WEBHOOK_SECRET:'bridge-test',NOC_META_APP_SECRET:appSecret,NOC_META_PAGE_IDS:page+',282598955251288'};
vm.runInNewContext(transpile('app/api/noc-foam-messenger-check/route.ts'),{exports:output,Buffer,Response,AbortSignal,process:{env},require:name=>name==='@/lib/noc-messenger-token-check'?library:require(name),console:{log:(...v)=>logs.push(v),error:(...v)=>logs.push(v)}});
function signed(body={pageId:page,pageToken:token},timestamp=String(Date.now()),domain='noc-messenger-check-v1'){
  const raw=JSON.stringify(body),signature=crypto.createHmac('sha256',env.NOC_FOAM_WEBHOOK_SECRET).update(domain+'\n'+timestamp+'\n'+raw).digest('hex');
  return new Request('https://example.test/api/noc-foam-messenger-check',{method:'POST',headers:{'content-type':'application/json','x-noc-timestamp':timestamp,'x-noc-signature':signature},body:raw});
}
(async()=>{
  assert.equal((await output.GET()).status,200);
  assert.equal((await output.POST(new Request('https://example.test',{method:'POST',body:'{}'}))).status,401);
  assert.equal((await output.POST(signed(undefined,String(Date.now()-400000)))).status,401);
  assert.equal((await output.POST(signed(undefined,undefined,'noc-discord-relay-v1'))).status,401);
  assert.equal((await output.POST(signed({pageId:'821716087685022',pageToken:token}))).status,400);
  assert.equal((await output.POST(signed({pageId:page,pageToken:'bad'}))).status,400);
  assert.equal(calls.length,0,'Invalid callers and unapproved Pages cannot inspect tokens');
  const response=await output.POST(signed()),result=await response.json();assert.equal(response.status,200);assert.equal(result.ok,true);assert.equal(result.pageId,page);assert.equal(result.appId,app);
  assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(!JSON.stringify(result).includes(token)&&!JSON.stringify(result).includes(appSecret));
  assert.equal(calls[0].hostname,'graph.facebook.com');assert.equal(calls[0].method,'GET');assert.equal(calls[0].headers.Authorization,'Bearer '+app+'|'+appSecret);
  assert.equal(calls[0].path,'/v26.0/debug_token?input_token='+encodeURIComponent(token));assert.ok(!calls[0].path.includes(appSecret));
  for(const [change,reason]of [[{is_valid:false},'TOKEN_INVALID'],[{app_id:'999999999'},'APP_MISMATCH'],[{type:'USER'},'TOKEN_TYPE'],[{profile_id:'282598955251288'},'PAGE_MISMATCH'],[{profile_id:null},'PAGE_UNKNOWN'],[{scopes:['pages_read_engagement']},'MISSING_MESSAGING'],[{expires_at:1},'TOKEN_EXPIRED'],[{data_access_expires_at:1},'TOKEN_EXPIRED'],[{granular_scopes:[{scope:'pages_messaging',target_ids:['282598955251288']}]},'PAGE_SCOPE_MISMATCH']]){
    assert.equal(library.validateNocPageToken({...valid,...change},page).reason,reason);
  }
  assert.equal(library.validateNocPageToken({...valid,scopes:['pages_messaging']},page).ok,true,'Messenger validation does not require unrelated Page read permission');
  for(const kind of ['denied','network','invalid-json','oversized','redirect']){
    mode=kind;const result=await (await output.POST(signed())).json();assert.equal(result.ok,false);assert.ok(!JSON.stringify(result).includes(token)&&!JSON.stringify(result).includes(appSecret));
    if(kind==='denied'){assert.equal(result.metaStatus,400);assert.equal(result.metaCode,100);}
  }
  mode='';subscriptionData=[{object:'page',active:true,callback_url:'https://nexora-point-system.vercel.app/api/noc-foam-messenger',fields:[{name:'messages'},{name:'message_echoes'}]},{object:'instagram',callback_url:'https://private.test/?token='+token}];
  const webhooks=await (await output.POST(signed({operation:'webhook-status'}))).json();
  assert.equal(webhooks.ok,true);assert.equal(webhooks.pageSubscriptions.length,1);
  assert.deepEqual(webhooks.pageSubscriptions[0],{active:true,callbackMatches:true,messages:true,messageEchoes:true});
  assert.equal(calls.at(-1).path,'/v26.0/'+app+'/subscriptions');assert.equal(calls.at(-1).method,'GET');
  assert.ok(!JSON.stringify(webhooks).includes(token));
  subscriptionData=[{object:'page',active:false,callback_url:'https://private.test/?secret='+token,fields:[]}];
  const wrong=await (await output.POST(signed({operation:'webhook-status'}))).json();
  assert.equal(wrong.pageSubscriptions[0].callbackMatches,false);assert.equal(wrong.pageSubscriptions[0].messages,false);
  assert.ok(!JSON.stringify(wrong).includes('private.test'));
  subscriptionData=[];assert.equal((await (await output.POST(signed({operation:'webhook-status'}))).json()).pageSubscriptions.length,0);
  mode='denied';const denied=await (await output.POST(signed({operation:'webhook-status'}))).json();assert.equal(denied.metaCode,100);assert.ok(!JSON.stringify(denied).includes(appSecret));
  mode='';const before=calls.length;delete env.NOC_META_APP_SECRET;assert.equal((await output.POST(signed())).status,503);assert.equal(calls.length,before);
  assert.deepEqual(logs,[],'No application logs may contain provider responses, tokens or URL query strings');
  console.log('PASS Messenger token check: signed/fresh/domain-bound calls, fixed two-Page allowlist, app/type/profile/scope/expiry checks, no Page read dependency, bounded core HTTPS, sanitized errors, no credentials returned/logged, no customer sends.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
