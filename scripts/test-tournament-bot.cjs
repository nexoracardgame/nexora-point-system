const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const cache={};function load(file){if(cache[file])return cache[file].exports;const m=cache[file]={exports:{}};const req=id=>id==='@/public/cards/card-skill-db.json'?require('../public/cards/card-skill-db.json'):id==='./prisma'?{prisma:{}}:id.startsWith('./')?load('lib/'+id.slice(2)+'.ts'):require(id);vm.runInThisContext(`(function(require,module,exports){${ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText}\n})`)(req,m,m.exports);return m.exports;}
const triad=load('lib/triad-dominion.ts'),search=load('lib/battle-bot-search.ts'),store=load('lib/pentad-room-store.ts');
const cards=triad.triadCards.filter(c=>c.kind==='monster');
const skills=triad.triadCards.filter(c=>c.kind==='skill').map(c=>c.cardNo);
const started=performance.now();let wins=0,baseline=0;
for(let i=0;i<60;i++){
 const turn=i%2?2:3,enemy={top:cards[(i*7)%cards.length].cardNo,[turn===2?'left':'right']:skills[(i*3)%skills.length]},own={top:cards[(i*11+2)%cards.length].cardNo};
 const pool=Array.from({length:12},(_,n)=>skills[(i+n*7)%skills.length]);
 const best=search.bestTriadBotPlay(turn,enemy,own,pool);assert.ok(pool.includes(best.cardNo));assert.ok(Number.isFinite(best.score));
 const result=triad.resolveTriadTurn({turn,player:enemy,opponent:{...own,[turn===2?'left':'right']:best.cardNo},prioritySide:'opponent',skillTargets:{opponent:{[best.cardNo]:best.target}}});
 const first=triad.resolveTriadTurn({turn,player:enemy,opponent:{...own,[turn===2?'left':'right']:pool[0]},prioritySide:'opponent'});
 if(result.winner==='opponent')wins++;if(first.winner==='opponent')baseline++;
}
assert.ok(wins>=baseline,'Search beats or matches the first-card baseline');
const host={id:'h',name:'H',image:''},bot={id:store.PENTAD_BOT_ID,name:'BOT',image:''};
for(const turn of [2,3,4,5]){
 const room=store.newPentadRoom('123456',host);room.seats.challenger=bot;room.phase='select';room.turn=turn;room.board={host:['099'],challenger:['177']};room.picks={host:'004',challenger:''};room.decks.host={monsters:[],hand:['004','005'],reserve:[]};room.decks.challenger={monsters:[],hand:['001','003','245','268'],reserve:[]};room.opener='host';room.deadline=Date.now()+120000;
 store.tickPentadRoom(room);assert.ok(room.picks.challenger);assert.ok(room.phase==='result'||room.phase==='target');
}
console.log(`Tournament bot: 60 real-data searches, ${wins} wins vs ${baseline} first-card baseline; legal choices and every Pentad skill turn passed in ${Math.round(performance.now()-started)}ms`);
