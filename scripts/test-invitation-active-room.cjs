const assert=require('node:assert/strict');
const load=require('./game-collection-test-loader.cjs')({'./prisma':{prisma:{$queryRawUnsafe:()=>{throw Error('Transaction must not request a second connection');}}}});
const {findActiveGameRoom}=load('lib/active-game-room.ts');
(async()=>{
 const seen=[];
 const tx={$queryRawUnsafe:async sql=>{seen.push(sql);if(sql.includes('pg_tables'))return [{name:'TriadRoom'}];assert.ok(sql.includes('FROM "TriadRoom"'),'Absent tables are not queried inside transactions');return [{code:'123456',updatedAt:new Date()}];}};
 assert.deepEqual(await findActiveGameRoom('actor',tx),{mode:'triad',code:'123456'});
 assert.equal(seen.length,2);
 console.log('Invitation active-room lookup: same DB connection, missing tables skipped safely');
})().catch(e=>{console.error(e);process.exitCode=1});
