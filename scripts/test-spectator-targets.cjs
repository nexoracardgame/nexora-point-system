const assert=require('node:assert/strict');
const load=require('./game-collection-test-loader.cjs')({'./prisma':{prisma:{}}});
const p=load('lib/pentad-room-store.ts'),h=load('lib/heptad-room-store.ts');
const {legalTargetPreview}=load('lib/battle-target-preview.ts');
const a={id:'a',name:'A',image:''},b={id:'b',name:'B',image:''},s={id:'s',name:'Spectator',image:''};
for(const mode of ['pentad','heptad']){
 const room=mode==='pentad'?p.newPentadRoom('123456',a):h.newHeptadRoom('123456',a);
 const lobby=mode==='pentad'?room:room.lobby;lobby.seats.challenger=b;lobby.spectators=[s];
 room.phase='target';room.deadline=Date.now()+30000;room.epoch=7;
 room.choices=[{side:'host',cardNo:'232',options:['player-top>bot-top','bot-top>player-top'],value:'',deadline:room.deadline}];
 const apply=mode==='pentad'?p.applyPentadAction:h.applyHeptadAction;
 const publicRoom=mode==='pentad'?p.publicPentadRoom:h.publicHeptadRoom;
 const body={action:'target',preview:true,epoch:7,cardNo:'232',choiceIndex:0,target:'player-top'};
 apply(room,a,body);
 assert.equal(room.choices[0].value,'','Preview must not confirm the skill');
 assert.equal(room.phase,'target');
 for(const viewer of [s,b]){
  const visible=publicRoom(room,viewer.id);
  assert.deepEqual(visible.choices[0].options,room.choices[0].options);
  assert.equal(visible.choices[0].preview,'player-top');
  assert.equal(mode==='pentad'?visible.decks.host.hand.length:visible.decks.host.length,0,'Private hand remains hidden');
 }
 assert.throws(()=>apply(room,s,{...body,target:'bot-top'}));
 assert.throws(()=>apply(room,b,{...body,target:'bot-top'}));
 assert.throws(()=>apply(room,a,{...body,target:'missing'}));
 assert.throws(()=>apply(room,a,{...body,epoch:6}));
 assert.throws(()=>apply(room,a,{...body,cardNo:'999'}));
 apply(room,a,{...body,target:'bot-top>player-top'});
 assert.equal(publicRoom(room,s.id).choices[0].preview,'bot-top>player-top');
 console.log(`${mode}: full spectator options, live ordered preview, no commit, private decks and authorization passed`);
}
assert.equal(legalTargetPreview(['a>b'],'a>a'),false);
assert.equal(legalTargetPreview(['a>b'],'b'),false);
assert.equal(legalTargetPreview(['a>b'],''),true);
