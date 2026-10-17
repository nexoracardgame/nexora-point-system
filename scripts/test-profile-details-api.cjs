const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
let authenticated=true,seen=[];
const exportsObject={};
const code=ts.transpileModule(fs.readFileSync('app/api/game-profile/details/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const dependencies={
 'next/server':{NextResponse:{json:(data,options)=>({data,status:options?.status||200})}},
 'next-auth':{getServerSession:async()=>authenticated?{user:{id:'self'}}:null},
 '@/lib/auth':{authOptions:{}},
 '@/lib/prisma':{prisma:{user:{findUnique:async args=>{seen.push(args);return args.where.id==='missing'?null:{id:args.where.id,name:'Player',image:'/avatar.png'}}},$queryRawUnsafe:async(sql,id)=>{seen.push(id);return [{wins:5,losses:2}]}}},
 '@/lib/game-profile-store':{readGameAppearance:async id=>{seen.push(id);return {avatar:'',frame:'gold',hero:'gold'}}},
 '@/lib/game-profile-options':{defaultGameAppearance:{}},
 '@/lib/local-profile-store':{getLocalProfileByUserId:async id=>({displayName:'Name '+id})},
 '@/lib/triad-room-store':{rankForWins:()=>({rankName:'Bronze',nextRankWins:null})},
};
new Function('require','exports',code)(id=>dependencies[id],exportsObject);
(async()=>{let result=await exportsObject.GET(new Request('https://test/api?id=friend'));assert.equal(result.data.user.id,'friend');assert.equal(result.data.user.name,'Name friend');assert.deepEqual(seen.find(v=>typeof v==='object').select,{id:true,name:true,image:true});assert.ok(!seen.includes('self'));seen=[];result=await exportsObject.GET(new Request('https://test/api'));assert.equal(result.data.user.id,'self');result=await exportsObject.GET(new Request('https://test/api?id=missing'));assert.equal(result.status,404);authenticated=false;seen=[];result=await exportsObject.GET(new Request('https://test/api?id=friend'));assert.equal(result.status,401);assert.equal(seen.length,0);console.log('Profile API: target-scoped public fields, self fallback, not-found and authentication passed')})().catch(e=>{console.error(e);process.exitCode=1});
