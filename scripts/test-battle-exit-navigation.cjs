const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const moduleUnderTest={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/battle-lobby-navigation.ts','utf8'),{compilerOptions:{module:1,target:9}}).outputText)(moduleUnderTest,moduleUnderTest.exports);
const {returnToBattleLobby}=moduleUnderTest.exports;
for(const mode of ['pentad','heptad']){
 let active=true,room={code:'123456'},timer,hard=0,navigated=0;
 global.window={location:{pathname:'/game',replace:()=>hard++},setTimeout:fn=>{timer=fn}};
 returnToBattleLobby({replace:path=>{assert.equal(path,'/game');assert.equal(active,false,'Parent must stop rendering the room before routing');navigated++}},()=>{active=false;room=null});
 assert.equal(active,false);assert.equal(room,null);assert.equal(navigated,1);assert.equal(timer,undefined,'Inline exit does not need a reload');
 window.location.pathname='/game/'+mode;
 returnToBattleLobby({replace:()=>navigated++});assert.ok(timer);timer();assert.equal(hard,1,'A stalled standalone route has a bounded recovery');
 hard=0;window.location.pathname='/game/'+mode;returnToBattleLobby({replace:()=>{window.location.pathname='/game'}});timer();assert.equal(hard,0,'Successful navigation does not trigger a second reload');
}
const parent=fs.readFileSync('app/(main)/battle/triad-dominion/TriadDominionClient.tsx','utf8');
assert.equal((parent.match(/onExitToLobby=\{exitHandoffToLobby\}/g)||[]).length,2);
assert.ok(parent.includes('setPentadHandoff(null);setHeptadHandoff(null)'));
const triadExit=parent.slice(parent.indexOf('const leaveRoom = async'),parent.indexOf('const continueRoomBattle'));
assert.ok(triadExit.indexOf('setPhase("lobby")')<triadExit.indexOf('sendBattleRoomExit'),'TRIAD does not block its lobby UI on leave acknowledgement');
for(const file of ['app/game/heptad/HeptadClient.tsx','app/(main)/battle/pentad-dominion/PentadDominionClient.tsx']){
 const source=fs.readFileSync(file,'utf8');assert.ok(source.includes('returnToBattleLobby(router,onExitToLobby)'));assert.ok(source.includes('confirmBattleLeave()'),'Confirmation stays intact');
}
console.log('All modes: inline parent release, same-route exit, standalone recovery, no reload after success and confirmation guards passed');
