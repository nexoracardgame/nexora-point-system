const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const cache={};
function load(file){
 if(cache[file])return cache[file].exports;
 const module=cache[file]={exports:{}};
 const req=id=>id==='@/public/cards/card-skill-db.json'?require('../public/cards/card-skill-db.json'):id==='./prisma'?{prisma:{}}:id.startsWith('./')?load('lib/'+id.slice(2)+'.ts'):require(id);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInThisContext(`(function(require,module,exports){${code}\n})`,{filename:file})(req,module,module.exports);return module.exports;
}
const triad=load('lib/triad-dominion.ts'),pentad=load('lib/pentad-dominion.ts'),store=load('lib/pentad-room-store.ts'),privacy=load('lib/triad-room-privacy.ts');
const fire=triad.triadCards.find(c=>c.kind==='monster'&&c.element==='fire'),water=triad.triadCards.find(c=>c.kind==='monster'&&c.element==='water');
const fireBuff=triad.triadSkillRules.find(rule=>rule.elementHint==='fire'&&rule.effects.some(effect=>effect.metric==='attack'&&effect.delta>0)&&rule.target==='own-all');
assert.ok(fire&&water);
for(const reversed of [false,true]){
 for(const target of [fire,water]){
  const curse={top:water.cardNo,left:'268'},victim={top:target.cardNo,left:fireBuff.cardNo};
  const result=triad.resolveTriadTurn({turn:2,player:reversed?victim:curse,opponent:reversed?curse:victim,prioritySide:reversed?'opponent':'player'});
  const total=reversed?result.playerTotal:result.opponentTotal;
  assert.ok(target.element!=='fire'||total===0,'268 keeps fire main ATK unusable even after an ATK buff, on either side');
  assert.ok(target.element==='fire'||total>=target.attack,'268 cannot zero non-fire ATK '+JSON.stringify({rule:triad.triadSkillRuleByNo.get('268'),target,total,result}));
 }
 const copy=triad.resolveTriadTurn({turn:2,player:{top:fire.cardNo,left:reversed?'268':'245'},opponent:{top:fire.cardNo,left:reversed?'245':'268'},prioritySide:reversed?'opponent':'player',skillTargets:{[reversed?'opponent':'player']:{245:'copy:268'}}});
 assert.equal(reversed?copy.playerTotal:copy.opponentTotal,0,'245 copies 268 stat-use lock for its owner');
 assert.equal(reversed?copy.opponentTotal:copy.playerTotal,fire.attack,'Original copied curse cannot wrongly target the copier');
}
for(const turn of [2,3,4,5]){
 const r=pentad.resolvePentadTurn({fight:1,turn,mains:{host:water.cardNo,challenger:fire.cardNo},skills:{host:'268',challenger:'004'},opener:'host'});
 if(turn<4)assert.equal(r.totals.challenger,0);else assert.equal(r.totals.challenger,fire.support);
}
const a=triad.resolveTriadTurn({turn:2,player:{top:fire.cardNo,left:'245'},opponent:{top:water.cardNo,left:'004',right:'001'},skillTargets:{player:{245:'copy:001'}}});
assert.ok(a.skillEvents.some(e=>e.cardNo==='245'&&e.summary.includes('001')),'Explicit historical field copy is used, not the current lane');
const clientSource=fs.readFileSync(process.env.TRIAD_CLIENT_SOURCE||'app/(main)/battle/triad-dominion/TriadDominionClient.tsx','utf8');
const ast=ts.createSourceFile('client.tsx',clientSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const localResolver=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='resolveTriadTurn');
const localContext=vm.createContext({resolveTriadTurnRules:triad.resolveTriadTurn,triadCardByNo:triad.triadCardByNo,bestTriadBotPlay:load('lib/battle-bot-search.ts').bestTriadBotPlay});
vm.runInContext(ts.transpileModule(localResolver.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,localContext);
const localBlessing=localContext.resolveTriadTurn({turn:2,player:{top:fire.cardNo,left:'245'},opponent:{top:water.cardNo,left:'254'},skillTargets:{player:{245:'copy:254>reroll-own'}},randomMonsterSeed:'qa'});
assert.notEqual(localBlessing.effectivePlayer.top,fire.cardNo,'Local copy of blessing changes the selected main for the current turn');
const host={id:'h',name:'Host',image:''},rival={id:'c',name:'Challenger',image:''};
const room=store.newPentadRoom('123456',host);room.seats.challenger=rival;room.phase='select';room.turn=2;room.opener='host';room.picks.host='268';room.board.host=['021','268'];room.boost.host='245';
for(const id of ['c','spectator']){
 const view=store.publicPentadRoom(room,id);assert.equal(view.picks.host,'hidden');assert.equal(view.board.host[1],'');assert.equal(view.boost.host,'');
}
assert.equal(store.publicPentadRoom(room,'h').picks.host,'268');assert.equal(room.picks.host,'268','Privacy never mutates authoritative state');
const raw={code:'654321',seats:{host,challenger:rival},game:{activeTurn:2,triangles:{host:{top:'021',left:'268',right:''},challenger:{top:'099',left:'',right:''}},decks:{host:['268','245'],challenger:['004']},selectionPools:{host:['268'],challenger:[]},usedCards:{host:['021','268'],challenger:['099']},turns:[{turn:1}],skillChoices:[{turn:2,side:'host',cardNo:'268',selectedTarget:'bot-top'}],openerTieBreak:{status:'waiting',choices:{host:'rock',challenger:'paper'}}}};
for(const id of ['c','spectator']){
 const view=privacy.triadRoomForViewer(raw,id);assert.equal(view.game.triangles.host.left,'hidden');assert.ok(!view.game.usedCards.host.includes('268'));assert.ok(!view.game.decks.host.includes('245'));assert.equal(view.game.skillChoices[0].cardNo,'hidden');assert.equal(view.game.openerTieBreak.choices.host,undefined);
}
raw.game.triangles.challenger.left='004';assert.equal(privacy.triadRoomForViewer(raw,'c').game.triangles.host.left,'268','Target preparation reveals both committed lanes together');
assert.equal(raw.game.triangles.host.left,'268');
const route=fs.readFileSync('app/api/triad-rooms/route.ts','utf8');assert.ok(route.includes('room: _room, ...notification'),'Realtime broadcasts only invalidation, never a room snapshot');
console.log('245/268: copied field skill, fire-only ATK lock, copied curse, both sides, all Pentad skill turns; player/spectator HTTP privacy and realtime invalidation passed');
