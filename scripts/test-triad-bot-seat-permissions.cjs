const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const source=fs.readFileSync('lib/triad-room-store.ts','utf8'),ast=ts.createSourceFile('store.ts',source,99,true);
const names=new Set(['setTriadRoomBotOpponent','canControlStoredRoom','isTriadBotParticipant','triadBotParticipant','withRoomMutationLock']);
const code=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.has(n.name?.text)).map(n=>n.getText(ast)).join('\n');
let stored,writes=0;
const ctx=vm.createContext({exports:{},Date,globalForTriadRooms:{},TRIAD_BOT_ID:'triad-bot-level-99',TRIAD_BOT_NAME:'BOT',TRIAD_BOT_IMAGE:'/avatar.png',cleanText:String,warmBotMemory:async()=>{},getStoredRoom:async()=>structuredClone(stored),upsertStoredRoom:async room=>{stored=structuredClone(room);writes++},publicRoom:room=>structuredClone(room),freshGameForRoom:()=>({deckMode:'all'})});
vm.runInContext(ts.transpileModule(code,{compilerOptions:{module:1,target:9}}).outputText,ctx);
(async()=>{
 stored={code:'test',hostId:'owner',status:'waiting',seats:{host:null,challenger:null},spectators:[{id:'owner'},{id:'visitor'}],game:{}};
 assert.equal((await ctx.setTriadRoomBotOpponent('test','visitor',true,'host')).reason,'not_host');assert.equal(writes,0);
 for(const side of ['host','challenger'])assert.equal((await ctx.setTriadRoomBotOpponent('test','owner',true,side)).ok,true);
 assert.ok(stored.seats.host&&stored.seats.challenger);assert.equal(stored.spectators.length,2);
 await ctx.setTriadRoomBotOpponent('test','owner',false,'host');assert.equal(stored.seats.host,null);assert.ok(stored.seats.challenger);
 stored.seats.host={id:'human',name:'Human'};assert.equal((await ctx.setTriadRoomBotOpponent('test','owner',true,'host')).reason,'slot_taken');assert.equal(stored.seats.host.id,'human');
 stored.status='playing';stored.game={};assert.equal((await ctx.setTriadRoomBotOpponent('test','owner',false,'challenger')).reason,'already_playing');
 console.log('TRIAD bot seats: spectator owner controls either side; visitors, occupied human seats and active matches protected');
})().catch(e=>{console.error(e);process.exitCode=1});
