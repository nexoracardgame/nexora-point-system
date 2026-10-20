const assert=require('node:assert/strict');
const load=require('./game-collection-test-loader.cjs')();
const {isTrustedGameOrigin}=load('lib/game-request-origin.ts');
const keys=['NEXTAUTH_URL','NEXT_PUBLIC_APP_URL','APP_URL','VERCEL_URL','VERCEL_PROJECT_PRODUCTION_URL','VERCEL_ENV'];
const saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
try{
 keys.forEach(key=>delete process.env[key]);
 const request=(origin,headers={})=>new Request('http://internal-server/api/game-gacha',{headers:{...(origin?{origin}:{}),...headers}});
 assert.equal(isTrustedGameOrigin(request('http://internal-server')),true);
 for(const origin of [undefined,'null','https://evil.test','https://game.test.evil.test','https://game.test/path'])assert.equal(isTrustedGameOrigin(request(origin)),false);
 process.env.NEXTAUTH_URL='https://game.test';assert.equal(isTrustedGameOrigin(request('https://game.test')),true,'Configured public URL works behind proxy');
 assert.equal(isTrustedGameOrigin(request('https://evil.test',{'x-forwarded-host':'evil.test','x-forwarded-proto':'https'})),false,'Spoofed forwarded headers never grant access');
 process.env.VERCEL_ENV='production';assert.equal(isTrustedGameOrigin(request('https://nexora-point-system.vercel.app')),true,'Installed game canonical URL is accepted in production');
 console.log('Origin guard: direct, configured proxy, native production URL accepted; absent, null, malicious and spoofed hosts blocked');
}finally{for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
