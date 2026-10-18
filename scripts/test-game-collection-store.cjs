const assert=require('node:assert/strict'),createLoader=require('./game-collection-test-loader.cjs');
let state={owned:[],decks:[],grants:[]},tail=Promise.resolve(),queries=[];
function database(get){return {
 user:{findUnique:async({where})=>where.id?{nexPoint:120,coin:5}:null},
 $executeRawUnsafe:async(sql,...p)=>{
  queries.push(sql);const db=get();if(sql.startsWith('CREATE')||sql.includes('pg_advisory'))return 0;
  if(sql.startsWith('INSERT INTO "GameCardGrant"')){db.grants.push({id:p[0],owner:p[1],reference:p[2],source:p[3],payload:JSON.parse(p[4]).map(item=>({quantity:item.quantity,cardNo:item.cardNo}))});return 1}
  if(sql.startsWith('INSERT INTO "GameOwnedCard"')){const items=JSON.parse(p[1]);for(const item of items){const card=db.owned.find(card=>card.owner===p[0]&&card.cardNo===item.cardNo);if(card)card.quantity+=item.quantity;else db.owned.push({owner:p[0],cardNo:item.cardNo,quantity:item.quantity,favorite:false,acquiredAt:new Date()})}return items.length}
  if(sql.startsWith('UPDATE "GameOwnedCard"')){const card=db.owned.find(card=>card.owner===p[1]&&card.cardNo===p[2]);if(!card)return 0;card.favorite=p[0];return 1}
  if(sql.startsWith('UPDATE "GameTimedCard"'))return 0;
  throw Error('Unexpected execute '+sql);
 },
  $queryRawUnsafe:async(sql,...p)=>{queries.push(sql);const db=get();if(sql.includes('FROM "GameTimedCard"'))return [];if(sql.includes('FROM "GameOwnedCard"'))return db.owned.filter(card=>card.owner===p[0]).map(({owner,...card})=>structuredClone(card));if(sql.includes('FROM "GameCardGrant"'))return db.grants.filter(grant=>grant.owner===p[0]&&grant.reference===p[1]);if(sql.startsWith('SELECT COUNT'))return [{count:db.decks.filter(deck=>deck.owner===p[0]).length}];if(sql.startsWith('INSERT INTO "GameSavedDeck"')){const deck={id:p[0],owner:p[1],name:p[2],format:p[3],cards:JSON.parse(p[4]),version:1,updatedAt:new Date()};db.decks.push(deck);return [structuredClone(deck)]}if(sql.startsWith('UPDATE "GameSavedDeck"')){const deck=db.decks.find(deck=>deck.id===p[3]&&deck.owner===p[4]&&deck.version===p[5]);if(!deck)return [];Object.assign(deck,{name:p[0],format:p[1],cards:JSON.parse(p[2]),version:deck.version+1,updatedAt:new Date()});return [structuredClone(deck)]}if(sql.startsWith('DELETE FROM "GameSavedDeck"')){const index=db.decks.findIndex(deck=>deck.id===p[0]&&deck.owner===p[1]&&deck.version===p[2]);if(index<0)return [];return [{id:db.decks.splice(index,1)[0].id}]}if(sql.includes('FROM "GameSavedDeck"'))return db.decks.filter(deck=>deck.owner===p[0]).map(deck=>structuredClone(deck));throw Error('Unexpected query '+sql)}
}}
const prisma=database(()=>state);prisma.$transaction=fn=>{const job=tail.then(async()=>{const copy=structuredClone(state),value=await fn(database(()=>copy));state=copy;return value});tail=job.catch(()=>{});return job};
const load=createLoader({'server-only':{},'./prisma':{prisma}}),store=load('lib/game-collection-store.ts'),{emptyDeckCards}=load('lib/game-collection.ts'),{triadCards}=load('lib/triad-dominion.ts');
(async()=>{
 const cardNo=triadCards.find(card=>card.kind==='monster').cardNo;
 const grants=await Promise.all(Array.from({length:5},()=>store.grantPermanentGameCards('a','reward-1','reward',[{cardNo,quantity:2}])));assert.equal(grants.filter(result=>result.applied).length,1);assert.equal(state.owned[0].quantity,2);assert.equal(state.grants.length,1);
 await assert.rejects(store.grantPermanentGameCards('a','reward-1','reward',[{cardNo,quantity:3}]),error=>error.status===409);assert.equal(state.owned[0].quantity,2);
 await assert.rejects(store.grantPermanentGameCards('a','bad','reward',[{cardNo:'fake',quantity:1}]));
 const cards=emptyDeckCards();cards.main=[cardNo,cardNo];const first=await store.saveGameDeck('a',{name:'Alpha',format:'triad-all',cards});assert.equal(first.version,1);
 await assert.rejects(store.saveGameDeck('b',{id:first.id,version:1,name:'Hijack',format:'triad-all',cards:emptyDeckCards()}),error=>error.status===409);
 const updated=await store.saveGameDeck('a',{...first,name:'Updated'});assert.equal(updated.version,2);
 await assert.rejects(store.saveGameDeck('a',{...first,name:'Stale'}),error=>error.status===409);
 await assert.rejects(store.saveGameDeck('a',{name:'Forged',format:'triad-all',cards:{...cards,main:[cardNo,cardNo,cardNo]}}),error=>error.status===422);
 await assert.rejects(store.saveGameDeck('a',{name:'Fake format',format:'coin-free',cards}),error=>error.status===400);
 await assert.rejects(store.deleteGameDeck('b',first.id,2),error=>error.status===409);
 await store.favoriteGameCard('a',cardNo,true);assert.equal((await store.readGameCollection('a')).owned[0].favorite,true);assert.equal((await store.readGameCollection('b')).owned.length,0);
 await store.deleteGameDeck('a',first.id,2);assert.equal(state.decks.length,0);assert.equal(state.owned[0].quantity,2,'Deleting decks never deletes owned cards');
 assert.ok(queries.some(query=>query.includes('pg_advisory_xact_lock')));assert.equal(state.grants.length,1);console.log('Collection store: idempotent permanent grants, quantity enforcement, owner isolation, optimistic conflicts, favorites and deletion passed (database mocked)');
})().catch(error=>{console.error(error);process.exitCode=1});
