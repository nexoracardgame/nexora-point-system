const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');const server=require('next/server');
let calls=0;const m={exports:{}};const source=ts.transpileModule(fs.readFileSync('app/api/game-account/register/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInThisContext(`(function(require,module,exports){${source}\n})`)(id=>id==='next/server'?server:{gameAuthAddress:()=> 'test',registerGameCredential:async()=>{calls++;return {ok:true}}},m,m.exports);
(async()=>{
 const post=(body,headers={})=>m.exports.POST(new server.NextRequest('https://game.test/api/game-account/register',{method:'POST',headers:{Origin:'https://game.test','Content-Type':'application/json',...headers},body}));
 assert.equal((await post('{}',{Origin:'https://foreign.test'})).status,403);assert.equal((await post('{}',{'Content-Type':'text/plain'})).status,415);assert.equal((await post('{')).status,400);assert.equal((await post('x'.repeat(5000))).status,413);assert.equal((await post(JSON.stringify({password:'a',confirmPassword:'b'}))).status,400);assert.equal(calls,0);
 assert.equal((await post(JSON.stringify({username:'player',password:'safe password 123',confirmPassword:'safe password 123'}))).status,201);assert.equal(calls,1);
 console.log('Registration request guards passed: foreign origin, content type, malformed JSON, bounded body, password confirmation and valid request');
})().catch(error=>{console.error(error);process.exitCode=1});
