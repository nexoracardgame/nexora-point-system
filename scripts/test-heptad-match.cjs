const assert=require('node:assert/strict');
const load=require('./game-collection-test-loader.cjs')({'./prisma':{prisma:{}}});
const store=load('lib/heptad-room-store.ts'),rules=load('lib/heptad-rules.ts'),engine=load('lib/heptad-resolution.ts');
const {triadCards,triadCardByNo}=load('lib/triad-dominion.ts');
const owner={id:'owner',name:'Owner',image:'/avatar.png'},rival={id:'rival',name:'Rival',image:'/avatar.png'};
function room(){return store.newHeptadRoom('123456',owner,1)}
function action(r,actor,body,now=2){store.applyHeptadAction(r,actor,{epoch:r.epoch,...body},now)}
for(const tier of ['all','bronze','silver','gold']){
 for(let n=0;n<8;n++){
  const r=room();action(r,owner,{action:'watch'});action(r,owner,{action:'mode',tier});
  action(r,owner,{action:'bot',seat:'host',enabled:true});action(r,owner,{action:'bot',seat:'challenger',enabled:true});
  action(r,owner,{action:'start'});for(const side of ['host','challenger'])assert.deepEqual(rules.validateHeptadMatchDeck(r.decks[side],tier),[]);
  let now=3;
  for(let tick=0;tick<600&&r.phase!=='finished';tick++){
   store.tickHeptadRoom(r,now);now=Math.max(now+1,r.deadline+1);
   for(const side of ['host','challenger'])assert.ok(r.specialUsed[side]<=r.fight);
  }
  assert.equal(r.phase,'finished',`${tier}: bot match completes`);
  assert.ok(r.rounds.length>=21,`${tier}: all 21 turns played, got ${r.rounds.length}`);
  assert.ok(r.score.host+r.score.challenger<=21);
  assert.equal(r.lobby.spectators[0].id,owner.id);
 }
 console.log(`HEPTAD ${tier}: 8 full bot matches, 105-card decks, special quotas and score bounds passed`);
}
{
 const r=room();action(r,rival,{action:'join'});assert.equal(r.lobby.seats.challenger.id,rival.id);
 assert.throws(()=>action(r,rival,{action:'start'}));action(r,owner,{action:'start'});
 for(const actor of [owner,rival])action(r,actor,{action:'ready',decks:rules.completeHeptadMatchDeck(Array.from({length:3},rules.emptyHeptadDeck),'all')});
 store.tickHeptadRoom(r,3);const own=store.heptadAvailable(r,'host')[0];action(r,owner,{action:'pick',cardNo:own});
 const hidden=store.publicHeptadRoom(r,rival.id);assert.equal(hidden.picks.host,'hidden');assert.deepEqual(hidden.decks.host,[]);
 const spectator=store.publicHeptadRoom(r,'viewer');assert.deepEqual(spectator.decks.challenger,[]);assert.equal(spectator.picks.host,'hidden');
 assert.throws(()=>action(r,rival,{action:'pick',cardNo:'not-a-card'}));
 action(r,owner,{action:'leave'});assert.equal(r.phase,'finished');assert.equal(r.winner,'challenger');assert.throws(()=>action(r,owner,{action:'join'}));
 console.log('HEPTAD authorization, concealed choices, invalid cards, forfeit and blocked rejoin passed');
}
{
 const monsters=triadCards.filter(c=>c.kind==='monster');const a=monsters[0],b=monsters[1];
 const board={host:{1:a.cardNo,2:b.cardNo,3:'218',4:'219',5:b.cardNo,6:'218',7:'219'},challenger:{1:b.cardNo,2:a.cardNo,5:a.cardNo}};
 const base=engine.resolveHeptadClash({board,turn:4,opener:'host',casts:[],seed:'test'});
 assert.equal(base.totals.host,a.attack+b.attack);
 const sup=engine.resolveHeptadClash({board,turn:7,opener:'host',casts:[],seed:'test'});assert.equal(sup.totals.host,a.support+b.support);
 assert.deepEqual(base.events,[]);assert.deepEqual(sup.events,[]);
 console.log('HEPTAD branch monster totals and no inherited skills passed');
}
{
 const gold=triadCards.find(c=>c.kind==='monster'&&c.element==='gold');
 const fire=triadCards.find(c=>c.kind==='monster'&&c.element==='fire');
 const water=triadCards.find(c=>c.kind==='monster'&&c.element==='water');
 const board={host:{1:gold.cardNo,2:gold.cardNo,3:'018',5:gold.cardNo,6:'218'},challenger:{1:fire.cardNo,2:fire.cardNo,5:fire.cardNo}};
 const cast={side:'host',cardNo:'018',kind:'normal',target:'player-secondary'};
 const buff=engine.resolveHeptadClash({board,turn:3,opener:'host',casts:[cast],seed:'buff'});
 assert.equal(buff.totals.host,gold.attack*2+5000,'Current ATK skill includes both monster values');
 const next=engine.resolveHeptadClash({board,turn:4,opener:'host',casts:[],seed:'next'});
 assert.equal(next.totals.host,gold.attack*2,'Prior ATK skill is not reapplied');
 const sup=engine.resolveHeptadClash({board,turn:6,opener:'host',casts:[{side:'host',cardNo:'218',kind:'normal',target:'player-top'}],seed:'sup'});
 assert.equal(sup.totals.host,gold.support*2+3000);
 assert.equal(engine.resolveHeptadClash({board,turn:7,opener:'host',casts:[],seed:'sup-next'}).totals.host,gold.support*2);
 for(const enemy of [fire,water]){
  const field=structuredClone(board);field.challenger[1]=enemy.cardNo;
  const result=engine.resolveHeptadClash({board:field,turn:7,opener:'host',casts:[{side:'host',cardNo:'270',kind:'normal'}],seed:'270'});
  assert.equal(result.totals.challenger,(enemy.element==='fire'?0:enemy.support)+fire.support,'270 only suppresses an eligible fire main, not the secondary monster');
 }
 console.log('HEPTAD actual ATK/SUP skills, secondary targets, no carryover and card 270 eligibility passed');
}
{
 const gold=triadCards.find(c=>c.kind==='monster'&&c.element==='gold');
 const main=triadCards.find(c=>c.kind==='monster'&&c.element==='fire'&&c.attack>c.support);
 const board={host:{1:main.cardNo,2:gold.cardNo},challenger:{1:main.cardNo,2:gold.cardNo}};
 const resolve=casts=>engine.resolveHeptadClash({board,turn:3,opener:'host',casts,seed:'targets'});
 const buff={side:'host',cardNo:'018',kind:'normal',target:'player-secondary'};
 const debuff={side:'challenger',cardNo:'231',kind:'normal',target:'player-top'};
 const before=structuredClone(board),base=resolve([]).totals.host;
 assert.equal(resolve([buff,debuff]).totals.host,resolve([buff]).totals.host+resolve([debuff]).totals.host-base,'Each normal cast independently targets the main or secondary monster');
 assert.deepEqual(board,before,'Target views do not mutate the battlefield');
 const seal={side:'host',cardNo:'232',kind:'normal',target:'player-top>player-secondary'};
 assert.equal(resolve([seal]).totals.host,base,'Seal can drain and boost two distinct monsters on the same side');
 assert.equal(resolve([seal]).events.filter(e=>e.cardNo==='232'&&!e.blocked).length,2);
 const cancelled=engine.resolveHeptadClash({board,turn:3,opener:'challenger',casts:[seal,{side:'challenger',cardNo:'236',kind:'normal'}],seed:'cancel'});
 assert.equal(cancelled.events.filter(e=>e.cardNo==='232'&&!e.blocked).length,0,'The two-target seal still obeys skill cancellation');
 console.log('HEPTAD simultaneous main/secondary targeting and two-monster seal passed');
}
