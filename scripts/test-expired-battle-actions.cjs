const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:1,target:9,esModuleInterop:true}}).outputText;
const statusModule={exports:{}};new Function('require','module','exports',compile('lib/battle-action-status.ts'))(require,statusModule,statusModule.exports);
const {ExpiredBattleActionError,isExpiredBattleAction}=statusModule.exports;
const source=fs.readFileSync('app/(main)/battle/pentad-dominion/PentadDominionClient.tsx','utf8');
const start=source.indexOf('  const act = async'),end=source.indexOf('  useLayoutEffect(',start);
const actCode=ts.transpileModule(source.slice(start,end),{fileName:'act.ts',compilerOptions:{module:1,target:9}}).outputText;
function client(reply,advance=false){
 const state={posts:0,loads:0,errors:[],accepted:[]},roomRef={current:{code:'123456',epoch:5}},loadGeneration={current:0};
 const act=new Function('env',`const {roomRef,loadGeneration,isExpiredBattleAction,fetch,accept,load,setError}=env;const busyRef={current:false};const setBusy=()=>{},primeBattleAudio=()=>{},playMenuCue=()=>{},setEntering=()=>{};const router={replace:()=>{}};${actCode}return act;`)({roomRef,loadGeneration,isExpiredBattleAction,fetch:async()=>{state.posts++;if(advance)roomRef.current={code:'123456',epoch:6};return{ok:reply.status<400,status:reply.status,json:async()=>reply.data}},accept:room=>{state.accepted.push(room);roomRef.current=room},load:async()=>{state.loads++},setError:message=>{if(message)state.errors.push(message)}});
 return{act,state,roomRef};
}
(async()=>{
 for(const status of [200,409]){
  const c=client({status,data:{reason:'stale_round',ignored:true,room:{code:'123456',epoch:6}}});
  assert.equal(await c.act('pick',{cardNo:'006'},true),false);assert.equal(c.state.posts,1);assert.equal(c.state.loads,0);assert.equal(c.roomRef.current.epoch,6);assert.deepEqual(c.state.errors,[]);
 }
 const legacy=client({status:409,data:{error:'คำสั่งนี้เป็นของตาก่อนหน้า'}});await legacy.act('target',{},true);assert.deepEqual(legacy.state.errors,[]);assert.equal(legacy.state.loads,1);
 const late=client({status:409,data:{error:'ไม่ใช่ช่วงเลือกการ์ด'}},true);await late.act('pick',{},true);assert.deepEqual(late.state.errors,[]);
 const queued=client({status:200,data:{}});await queued.act('deck',{epoch:4,deck:{}},true);assert.equal(queued.state.posts,0);assert.deepEqual(queued.state.errors,[]);
 const genuine=client({status:403,data:{error:'ไม่มีสิทธิ์ลงสนาม'}});await genuine.act('pick',{},true);assert.deepEqual(genuine.state.errors,['ไม่มีสิทธิ์ลงสนาม']);
 assert.equal(isExpiredBattleAction({reason:'network_error'}),false);assert.equal(isExpiredBattleAction({error:'ยอดเงินไม่เพียงพอ'}),false);
 let calls=0,mode='stale';const latest={code:'123456',epoch:6};
 const routeModule={exports:{}};
 const mocks={
  'next/server':{NextResponse:require('next/server').NextResponse,after:()=>{}},
  '@/lib/admin-auth':{getApiActor:async()=>({id:'test-player',name:'Player'})},
  '@/lib/supabase-server':{getServerSupabaseClient:()=>null},
  '@/lib/active-game-room':{findActiveGameRoom:async()=>null},
  '@/lib/battle-action-status':statusModule.exports,
  '@/lib/pentad-room-store':{mutatePentadRoom:async(code,actor,body)=>{calls++;if(mode==='denied')throw Error('ไม่มีสิทธิ์ลงสนาม');if(body)throw new ExpiredBattleActionError();return latest}},
 };
 new Function('require','module','exports',compile('app/api/pentad-rooms/route.ts'))(id=>mocks[id]||require(id),routeModule,routeModule.exports);
 const request=()=>new Request('http://localhost/api/pentad-rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'pick',code:'123456',epoch:5,cardNo:'006'})});
 const response=await routeModule.exports.POST(request()),data=await response.json();assert.equal(response.status,200);assert.equal(calls,2);assert.equal(data.ignored,true);assert.equal(data.reason,'stale_round');assert.equal(data.room.epoch,6);assert.equal(data.error,undefined);assert.ok(response.headers.get('Cache-Control').includes('no-store'));
 mode='denied';const denied=await routeModule.exports.POST(request());assert.equal(denied.status,409);assert.equal((await denied.json()).error,'ไม่มีสิทธิ์ลงสนาม');
 console.log('Expired battle actions: silent snapshot refresh, legacy compatibility, no action replay, queued old-epoch cancellation, genuine errors preserved and API no-store passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
