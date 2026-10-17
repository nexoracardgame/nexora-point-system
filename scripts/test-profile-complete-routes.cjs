const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
let session={user:{id:'self'}},reads=[];
const details=id=>({user:{id,name:'Actual '+id,image:'/avatar.png'},appearance:{avatar:'',frame:'gold',hero:'gold'},available:true,stats:{wins:2,losses:1},rank:{name:'Bronze',nextWins:10,nextName:'Silver'}});
const mocks={'next-auth':{getServerSession:async()=>session},'next/navigation':{redirect:url=>{throw Error('redirect:'+url)},notFound:()=>{throw Error('notFound')}},'@/lib/auth':{authOptions:{}},'@/lib/game-profile-details':{readGameProfileDetails:async id=>{reads.push(id);return details(id)}},'@/components/GamePlayerProfile':{__esModule:true,default:()=>null}};
function load(file){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,m={exports:{}};new Function('require','module','exports',code)(id=>mocks[id]||require(id),m,m.exports);return m.exports.default;}
(async()=>{
 const own=load('app/game/profile/page.tsx'),other=load('app/game/profile/[id]/page.tsx');
 const a=await own();assert.equal(a.props.user.name,'Actual self');assert.equal(a.props.rank.name,'Bronze');assert.equal(a.props.stats.wins,2);
 const b=await other({params:Promise.resolve({id:'friend'})});assert.equal(b.props.user.id,'friend');assert.equal(b.props.readOnly,true);
 await assert.rejects(other({params:Promise.resolve({id:'self'})}),/redirect:\/game\/profile/);
 session=null;await assert.rejects(own(),/redirect:\/game\/login/);await assert.rejects(other({params:Promise.resolve({id:'friend'})}),/redirect:\/game\/login/);
 assert.deepEqual(reads,['self','friend']);console.log('Server profile routes: complete first payload, own/friend permissions and authentication passed');
})().catch(error=>{console.error(error);process.exitCode=1});
