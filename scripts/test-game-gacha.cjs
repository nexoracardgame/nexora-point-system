const assert=require('node:assert/strict'),crypto=require('node:crypto'),createLoader=require('./game-collection-test-loader.cjs');
let seed=19;const rng=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max};
const load=createLoader(),{rollGachaPack,gachaCatalog,gachaPolicy,weightedIndex}=load('lib/game-gacha.ts'),{rateGameSkill}=load('lib/game-skill-rating.ts'),{triadCards}=load('lib/triad-dominion.ts');
assert.equal(gachaCatalog.length,293);assert.equal(gachaCatalog.filter(card=>card.kind==='skill').length,88);
for(const card of triadCards.filter(card=>card.kind==='skill'))assert.ok(rateGameSkill(card).stars>=1);
for(const id of ['236','239','245','254','258','265','284'])assert.equal(gachaCatalog.find(card=>card.cardNo===id).stars,5);
for(const id of ['266','280'])assert.equal(gachaCatalog.find(card=>card.cardNo===id).stars,1);
const now=new Date('2026-10-18T00:00:00Z'),counts=[0,0,0,0,0];
for(let draw=0;draw<6000;draw++){
 let index=0;const forced=[draw,0,1,1];const result=rollGachaPack(max=>index<forced.length?forced[index++]:rng(max),now);counts[result.maxStars-1]++;
 assert.equal(result.cards.length,7);assert.equal(Math.max(...result.cards.map(card=>card.stars)),result.maxStars);assert.equal(result.cards.filter(card=>card.days===0).length,1);assert.equal(result.cards.filter(card=>card.guaranteedPermanent).length,1);
 for(const card of result.cards){assert.ok(gachaCatalog.some(item=>item.cardNo===card.cardNo&&item.stars===card.stars));assert.equal(card.expiresAt,card.days?new Date(now.getTime()+card.days*86400000).toISOString():null)}
}
assert.deepEqual(counts,[5320,300,200,120,60]);
let extraCount=0;for(let extra=0;extra<50;extra++){let index=0;const forced=[0,0,1,extra];const result=rollGachaPack(max=>index<forced.length?forced[index++]:rng(max),now);if(result.cards.filter(card=>!card.days).length===2)extraCount++}assert.equal(extraCount,1);
const lifetime=[0,0,0,0];for(let i=0;i<100;i++)lifetime[weightedIndex(gachaPolicy.temporaryWeights,i)]++;assert.deepEqual(lifetime,[60,25,10,5]);
console.log('Gacha policy: exact per-pack star odds, 2% second permanent, all 293 cards, 88 reviewed skills and 1/3/7/14 day expiration passed');

const roles={};
let state={coins:{a:790,b:78},draws:[],owned:[],timed:[],grants:[]},tail=Promise.resolve(),fail=false;
function database(get){return {
 user:{findUnique:async({where})=>Object.hasOwn(get().coins,where.id)?{coin:get().coins[where.id],role:roles[where.id],nexPoint:0}:null},
 $executeRawUnsafe:async(sql,...p)=>{const db=get();if(sql.startsWith('CREATE')||sql.includes('pg_advisory'))return 0;if(sql.startsWith('INSERT INTO "GameTimedCard"')){db.timed.push({id:p[0],owner:p[1],cardNo:p[2],expiresAt:p[3],acquiredAt:p[4],favorite:false});return 1}if(sql.startsWith('INSERT INTO "GameOwnedCard"')){if(fail)throw Error('Injected failure after debit');for(const item of JSON.parse(p[1])){const prior=db.owned.find(card=>card.owner===p[0]&&card.cardNo===item.cardNo);if(prior)prior.quantity+=item.quantity;else db.owned.push({...item,owner:p[0],favorite:false,acquiredAt:now})}return 1}if(sql.startsWith('INSERT INTO "GameCardGrant"')){db.grants.push({owner:p[1],reference:p[2]});return 1}if(sql.startsWith('INSERT INTO "GameGachaDraw"')){db.draws.push({owner:p[0],id:p[1],receipt:JSON.parse(p[2])});return 1}throw Error('Unexpected execute '+sql)},
 $queryRawUnsafe:async(sql,...p)=>{const db=get();if(sql.includes('FROM "User"'))return Object.hasOwn(db.coins,p[0])?[{coin:db.coins[p[0]],role:roles[p[0]],now}]:[];if(sql.startsWith('UPDATE "User"')){if((db.coins[p[1]]??-1)<p[0])return [];db.coins[p[1]]-=p[0];return [{coin:db.coins[p[1]]}]}if(sql.includes('FROM "GameGachaDraw"'))return db.draws.filter(row=>row.owner===p[0]&&(!p[1]||row.id===p[1])).map(row=>({receipt:row.receipt}));if(sql.includes('FROM "GameOwnedCard"'))return db.owned.filter(card=>card.owner===p[0]);if(sql.includes('FROM "GameTimedCard"')){const map=new Map();for(const row of db.timed.filter(card=>card.owner===p[0]&&card.expiresAt>now)){const prior=map.get(row.cardNo);map.set(row.cardNo,{...row,quantity:(prior?.quantity||0)+1,expiresAt:prior&&prior.expiresAt<row.expiresAt?prior.expiresAt:row.expiresAt})}return [...map.values()]}if(sql.includes('FROM "GameSavedDeck"'))return [];throw Error('Unexpected query '+sql)}
}}
const prisma=database(()=>state);prisma.$transaction=fn=>{const job=tail.then(async()=>{const copy=structuredClone(state),result=await fn(database(()=>copy));state=copy;return result});tail=job.catch(()=>{});return job};
const server=createLoader({'server-only':{},'./prisma':{prisma},'node:crypto':{...crypto,randomInt:rng}}),store=server('lib/game-gacha-store.ts'),collection=server('lib/game-collection-store.ts');
(async()=>{
 const id=crypto.randomUUID(),results=await Promise.all(Array.from({length:8},()=>store.openGamePack('a',id)));assert.equal(results.filter(item=>!item.replayed).length,1);assert.equal(state.coins.a,711);assert.equal(state.draws.length,1);assert.equal(state.owned.reduce((n,c)=>n+c.quantity,0)+state.timed.length,7);
 const inventory=await collection.readGameCollection('a');assert.equal(inventory.owned.reduce((n,c)=>n+c.quantity,0),7);assert.equal(inventory.owned.reduce((n,c)=>n+(c.temporaryQuantity||0),0),state.timed.length);
 await assert.rejects(store.openGamePack('b',crypto.randomUUID()),e=>e.status===422);assert.equal(state.coins.b,78);assert.equal((await store.readGameGacha('b')).history.length,0);
 state.coins.a=79;const concurrent=await Promise.allSettled(Array.from({length:5},()=>store.openGamePack('a',crypto.randomUUID())));assert.equal(concurrent.filter(item=>item.status==='fulfilled').length,1);assert.equal(state.coins.a,0);
 state.coins.a=79;const before=structuredClone(state);fail=true;await assert.rejects(store.openGamePack('a',crypto.randomUUID()));fail=false;assert.deepEqual(state,before,'Debit and grants must roll back together');
 for(const role of ['admin','GM',' Admin ','superadmin']){roles.b=role;state.coins.b=0;const id=crypto.randomUUID();const result=await store.openGamePack('b',id);assert.equal(result.coin,0);assert.equal(result.unlimitedCoin,true);assert.equal(result.receipt.chargedCoin,0);assert.equal(result.receipt.testDraw,true);assert.equal((await store.readGameGacha('b')).unlimitedCoin,true);assert.equal((await store.openGamePack('b',id)).replayed,true)}
 roles.b='user';await assert.rejects(store.openGamePack('b',crypto.randomUUID()),e=>e.status===422);assert.equal((await store.readGameGacha('b')).unlimitedCoin,false);
 console.log('Staff spending: zero-balance admin/GM, no debit, audit, replay and immediate revocation passed');
 await assert.rejects(store.openGamePack('a','forged-id'),e=>e.status===400);
 state.timed.forEach(card=>card.expiresAt=new Date(now.getTime()-1));const expired=await collection.readGameCollection('a');assert.equal(expired.owned.reduce((n,c)=>n+(c.temporaryQuantity||0),0),0);assert.equal(expired.owned.reduce((n,c)=>n+c.quantity,0),state.owned.filter(card=>card.owner==='a').reduce((n,c)=>n+c.quantity,0));
 console.log('Gacha store (transaction mock): concurrent idempotency, balance locks, rollback after debit, owner isolation, collection delivery and expiration passed');
})().catch(error=>{console.error(error);process.exitCode=1});
