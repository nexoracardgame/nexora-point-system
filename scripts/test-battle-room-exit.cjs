const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const mod={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/battle-room-exit.ts','utf8'),{compilerOptions:{module:1,target:9}}).outputText)(mod,mod.exports);
const {sendBattleRoomExit}=mod.exports;
(async()=>{
 const original=global.fetch;
 try {
  let release,calls=[];
  global.fetch=(url,options)=>{calls.push({url,options});return new Promise(resolve=>release=resolve)};
  const pending=sendBattleRoomExit('/api/triad-rooms',{code:'123456',participant:{id:'player'}});
  assert.equal(calls.length,1);assert.equal(calls[0].options.keepalive,true);
  assert.equal(JSON.parse(calls[0].options.body).action,'leave');
  release({ok:true});assert.equal(await pending,true);
  let count=0;global.fetch=async()=>{if(++count===1)throw Error('offline');return {ok:true}};
  assert.equal(await sendBattleRoomExit('/api/pentad-rooms',{code:'123456',epoch:2}),true);assert.equal(count,2);
  count=0;global.fetch=async()=>{count++;return {ok:false,status:403}};
  assert.equal(await sendBattleRoomExit('/api/pentad-rooms',{}),false);assert.equal(count,1);
  count=0;global.fetch=async()=>{count++;throw Error('offline')};
  assert.equal(await sendBattleRoomExit('/api/pentad-rooms',{}),false);assert.equal(count,2);
  for(const mode of ['triad','pentad']){
   const source=fs.readFileSync(`app/(main)/battle/${mode}-dominion/${mode==='triad'?'Triad':'Pentad'}DominionClient.tsx`,'utf8');
   const leave=source.slice(source.indexOf('  const leaveRoom = async'),source.indexOf('  const leaveRoom = async')+2200);
   assert.ok(leave.includes('void sendBattleRoomExit'));
   assert.ok(!leave.includes('await postRoomAction({ action: "leave"'));
   assert.ok(!leave.includes('await act("leave"'));
   if(mode==='triad')assert.ok(leave.indexOf('setPhase("lobby")')<leave.indexOf('sendBattleRoomExit'));
   else assert.ok(leave.indexOf("router.replace('/game')")<leave.indexOf('sendBattleRoomExit'));
   const ast=ts.createSourceFile('client.tsx',source,99,true,ts.ScriptKind.TSX);let node;
   function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='leaveRoom')node=n;ts.forEachChild(n,visit)}visit(ast);
   for(const seated of [false,true])for(const confirmed of [false,true]){
    let phase='battle',posts=0,cacheCleared=false,removed=false;
    const ref=value=>({current:value});const room={code:'123456',epoch:1,status:'playing',phase:'select',game:{matchEndedAt:0}};
    const noop=()=>{};
    const deps={leavingRoomRef:ref(false),currentRoom:room,isFieldPlayer:seated,confirmBattleLeave:async()=>confirmed,
     joiningRoomCodeRef:ref(''),setJoiningRoomCode:noop,dismissedRoomCodesRef:ref(new Set()),activeRoomCodeRef:ref(room.code),activeRoomSnapshotRef:ref(room),
     setActiveRoomCode:noop,setActiveRoomSnapshot:noop,writeCachedTriadRoom:()=>cacheCleared=true,setPhase:value=>phase=value,setRooms:noop,
     participant:{id:'player'},ROOM_API_PATH:'/api/triad-rooms',sendBattleRoomExit:()=>{posts++;return new Promise(()=>{})},setLobbyMessage:noop,
     side:seated?'host':undefined,room,roomRef:ref(room),exitedRoom:ref(false),loadGeneration:ref(0),clearPentadHandoff:noop,
     localStorage:{removeItem:()=>cacheCleared=true},setRoom:value=>removed=value===null,setPresentation:noop,setEntering:noop,busyRef:ref(false),setBusy:noop,
     router:{replace:()=>phase='lobby'}};
    const js=ts.transpileModule(`const leaveRoom=${node.initializer.getText(ast)};return leaveRoom;`,{compilerOptions:{module:1,target:9}}).outputText;
    const fn=new Function(...Object.keys(deps),js)(...Object.values(deps));
    await fn();
    assert.equal(phase, seated&&!confirmed?'battle':'lobby',`${mode}: local exit before stalled network`);
    assert.equal(posts,seated&&!confirmed?0:1);assert.equal(cacheCleared,!(seated&&!confirmed));
    if(mode==='pentad'&&posts)assert.ok(removed&&deps.exitedRoom.current);
   }
  }
  console.log('Room exit: immediate local departure, unmount-safe POST, bounded retries, authorization failure and both mode wiring passed');
 }finally{global.fetch=original}
})().catch(error=>{console.error(error);process.exitCode=1});
