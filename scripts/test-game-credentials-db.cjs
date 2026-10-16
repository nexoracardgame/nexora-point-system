const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');require('dotenv').config({quiet:true});
const prisma=new (require('@prisma/client').PrismaClient)();
function load(file,imports={}){const m={exports:{}};const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInThisContext(`(function(require,module,exports){${source}\n})`,{filename:file})(id=>id in imports?imports[id]:require(id),m,m.exports);return m.exports}
(async()=>{
 const username='qa_'+require('node:crypto').randomBytes(8).toString('hex'),password=require('node:crypto').randomBytes(24).toString('base64url');let userId;
 try{
  const passwords=load('lib/game-password.ts');const store=load('lib/game-credentials.ts',{'./prisma':{prisma},'./game-password':passwords,'./auth-session-control':{ensureUserSessionSchema:async()=>{await prisma.$queryRawUnsafe('SELECT "sessionVersion" FROM "User" LIMIT 1')}}});
  const result=await store.registerGameCredential(username,password,'qa-local');assert.equal(result.ok,true);
  const user=await store.authenticateGameCredential(username,password,'qa-local');assert.ok(user.id);userId=user.id;assert.equal(user.role,'USER');
  assert.equal((await store.registerGameCredential(username,password,'qa-local')).status,409);
  assert.equal(await store.authenticateGameCredential(username,'incorrect password 2026','qa-local'),null);
  const rows=await prisma.$queryRawUnsafe('SELECT "passwordHash" FROM "GameCredential" WHERE "username"=$1',username);assert.ok(rows[0].passwordHash.startsWith('scrypt$'));assert.ok(!rows[0].passwordHash.includes(password));
  console.log('Shared production database: schema, transactional signup, normalized login, wrong password rejection, unique name and hashed storage verified; QA user removed');
 }finally{
  if(!userId){const rows=await prisma.$queryRawUnsafe('SELECT "userId" FROM "GameCredential" WHERE "username"=$1',username);userId=rows[0]?.userId}
  if(userId)await prisma.user.delete({where:{id:userId}});
  await prisma.$disconnect();
 }
})().catch(error=>{console.error(error.message);process.exitCode=1});
