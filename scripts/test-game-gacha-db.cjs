// Uses a synthetic account inside one transaction that always rolls back.
if(!process.argv.includes('--rollback-only'))throw Error('Run with --rollback-only');
require('dotenv').config({quiet:true});
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),createLoader=require('./game-collection-test-loader.cjs');
const load=createLoader({'server-only':{}}),{prisma}=load('lib/prisma.ts'),{ensureGameGacha,openGamePackInTransaction}=load('lib/game-gacha-store.ts');
const owner='qa-gacha-'+randomUUID(),rollback=new Error('EXPECTED_ROLLBACK');
(async()=>{try{
 await ensureGameGacha();
 await assert.rejects(prisma.$transaction(async tx=>{
  await tx.user.create({data:{id:owner,lineId:owner,name:'Gacha rollback verification',coin:158}});
  const id=randomUUID(),first=await openGamePackInTransaction(tx,owner,id);assert.equal(first.coin,79);assert.equal(first.receipt.cards.length,7);
  const retry=await openGamePackInTransaction(tx,owner,id);assert.equal(retry.coin,79);assert.equal(retry.replayed,true);assert.deepEqual(retry.receipt,first.receipt);
  const second=await openGamePackInTransaction(tx,owner,randomUUID());assert.equal(second.coin,0);
  await assert.rejects(openGamePackInTransaction(tx,owner,randomUUID()),error=>error.status===422);
  const permanent=await tx.$queryRawUnsafe('SELECT COALESCE(SUM("quantity"),0)::int AS "count" FROM "GameOwnedCard" WHERE "userId"=$1',owner),timed=await tx.$queryRawUnsafe('SELECT COUNT(*)::int AS "count" FROM "GameTimedCard" WHERE "userId"=$1',owner),draws=await tx.$queryRawUnsafe('SELECT COUNT(*)::int AS "count" FROM "GameGachaDraw" WHERE "userId"=$1',owner);
  assert.equal(permanent[0].count+timed[0].count,14);assert.ok(permanent[0].count>=2);assert.equal(draws[0].count,2);
  await tx.$executeRawUnsafe('UPDATE "GameTimedCard" SET "expiresAt"=CURRENT_TIMESTAMP-INTERVAL \'1 second\' WHERE "userId"=$1',owner);
  const active=await tx.$queryRawUnsafe('SELECT COUNT(*)::int AS "count" FROM "GameTimedCard" WHERE "userId"=$1 AND "expiresAt">CURRENT_TIMESTAMP',owner);assert.equal(active[0].count,0);
  throw rollback;
 },{maxWait:20000,timeout:60000}),error=>error===rollback);
 assert.equal(await prisma.user.findUnique({where:{id:owner}}),null);
 const remains=await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS "count" FROM "GameGachaDraw" WHERE "userId"=$1',owner);assert.equal(remains[0].count,0);
 console.log('PostgreSQL rollback-only test passed: real SQL debit, retry, grants, insufficient funds and expiration; synthetic account and rewards rolled back');
}finally{await prisma.$disconnect()}})().catch(error=>{console.error(error.message);process.exitCode=1});
