const assert=require('node:assert/strict'),crypto=require('node:crypto');require('dotenv').config({quiet:true});
const {request}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.GAME_TEST_URL||'http://localhost:3013';
(async()=>{
 const api=await request.newContext({baseURL:base,extraHTTPHeaders:{Origin:base}}),prisma=new (require('@prisma/client').PrismaClient)();
 const username='qa_'+crypto.randomBytes(7).toString('hex'),password=crypto.randomBytes(24).toString('base64url');let userId;
 try{
  const denied=await api.post('/api/game-account/register',{headers:{Origin:'https://not-nexora.invalid'},data:{username,password,confirmPassword:password}});assert.equal(denied.status(),403);
  const registered=await api.post('/api/game-account/register',{data:{username,password,confirmPassword:password}});assert.equal(registered.status(),201,await registered.text());
  const duplicate=await api.post('/api/game-account/register',{data:{username:username.toUpperCase(),password,confirmPassword:password}});assert.equal(duplicate.status(),409);
  const csrf=async()=>(await(await api.get('/api/auth/csrf')).json()).csrfToken;
  const wrong=await api.post('/api/auth/callback/credentials',{form:{csrfToken:await csrf(),username,password:'incorrect password 2026',callbackUrl:base+'/game',json:'true'}});assert.ok((await wrong.json()).url.includes('CredentialsSignin'));
  const login=await api.post('/api/auth/callback/credentials',{form:{csrfToken:await csrf(),username,password,callbackUrl:base+'/game',json:'true'}});assert.equal(login.status(),200);assert.equal((await login.json()).url,base+'/game');
  const session=await(await api.get('/api/auth/session')).json();userId=session.user?.id;assert.ok(userId);assert.equal(session.user.authProvider,'credentials');assert.equal(session.user.name,username);assert.equal(session.user.role,'USER');
  const state=await api.storageState();assert.ok(state.cookies.some(cookie=>cookie.name.includes('session-token')&&cookie.httpOnly));
  const logout=await api.post('/api/auth/signout',{form:{csrfToken:await csrf(),callbackUrl:base+'/game/login',json:'true'}});assert.equal(logout.status(),200);assert.equal((await(await api.get('/api/auth/session')).json()).user,undefined);
  console.log('Live account flow passed: same-origin CSRF protection, signup, duplicate name, wrong password, shared NextAuth HttpOnly session, exact /game callback and logout; temporary QA account removed');
 }finally{
  if(!userId){const rows=await prisma.$queryRawUnsafe('SELECT "userId" FROM "GameCredential" WHERE "username"=$1',username);userId=rows[0]?.userId}
  if(userId)await prisma.user.delete({where:{id:userId}});
  await api.dispose();await prisma.$disconnect();
 }
})().catch(error=>{console.error(error.message);process.exitCode=1});
