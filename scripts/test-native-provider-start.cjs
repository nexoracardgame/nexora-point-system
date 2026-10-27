const assert=require('node:assert/strict');
const load=require('./game-collection-test-loader.cjs')();
const {nativeProviderStart}=load('lib/native-provider-start.ts');
const original=global.fetch;
(async()=>{try{
 for(const provider of ['google','line']){
  const calls=[];global.fetch=async(url,options)=>{calls.push({url:String(url),options});if(calls.length===1)return new Response(JSON.stringify({csrfToken:'fresh'}),{headers:{'Set-Cookie':'next-auth.csrf-token=fresh%7Chash; Path=/; HttpOnly'}});return new Response(JSON.stringify({url:provider==='google'?'https://accounts.google.com/o/oauth2/v2/auth?state=state':'https://access.line.me/oauth2/v2.1/authorize?state=state'}),{headers:{'Set-Cookie':'next-auth.state=state; Path=/; HttpOnly'}});};
  const callback='https://game.test/api/auth/native/issue?game=1&callbackUrl=%2Fgame&challenge=proof';
  const result=await nativeProviderStart('https://game.test',provider,callback,'next-auth.csrf-token=stale; session=keep');
  assert.equal(calls.length,2);assert.ok(result.url.includes(provider==='google'?'accounts.google.com':'access.line.me'));assert.equal(result.cookies.length,2);
  const post=calls[1].options;assert.equal(post.body.get('callbackUrl'),callback);assert.equal(post.body.get('csrfToken'),'fresh');assert.equal(post.body.get('json'),'true');assert.ok(post.headers.cookie.includes('session=keep'));assert.ok(!post.headers.cookie.includes('stale'));assert.equal(post.redirect,'manual');
 }
 global.fetch=async()=>new Response(JSON.stringify({csrfToken:''}));await assert.rejects(nativeProviderStart('https://game.test','google','https://game.test/',''));
 let count=0;global.fetch=async()=>new Response(JSON.stringify(++count===1?{csrfToken:'x'}:{url:'https://evil.test/'}));await assert.rejects(nativeProviderStart('https://game.test','line','https://game.test/',''));
 const fs=require('node:fs'),route=fs.readFileSync('app/api/auth/native/start/route.ts','utf8');assert.ok(!route.includes('<html'));assert.ok(!route.includes('<form'));assert.ok(route.includes("'/game/login'"));assert.ok(route.includes("response.headers.append('Set-Cookie',cookie)"));
 console.log('Native login: direct Google/LINE redirect, CSRF rotation, state cookies, callback proof, allowlisted destination and no interstitial HTML passed');
}finally{global.fetch=original}})().catch(e=>{console.error(e);process.exitCode=1});
