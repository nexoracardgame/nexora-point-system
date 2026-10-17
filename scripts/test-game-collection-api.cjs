const assert=require('node:assert/strict'),createLoader=require('./game-collection-test-loader.cjs');
let session=null,calls=[];
class CollectionError extends Error{constructor(message,status){super(message);this.status=status}}
const route=createLoader({'next-auth':{getServerSession:async()=>session},'@/lib/auth':{authOptions:{}},'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},'@/lib/game-collection-store':{CollectionError,readGameCollection:async owner=>{calls.push(['read',owner]);return {owned:[],decks:[]}},saveGameDeck:async(owner,input)=>{calls.push(['save',owner,input]);return {id:'safe'}},deleteGameDeck:async(...args)=>calls.push(['delete',...args]),favoriteGameCard:async(...args)=>calls.push(['favorite',...args])}})('app/api/game-collection/route.ts');
const post=body=>route.POST(new Request('https://test/api/game-collection',{method:'POST',body:JSON.stringify(body)}));
(async()=>{
 assert.equal((await route.GET()).status,401);assert.equal((await post({action:'save'})).status,401);assert.equal(calls.length,0);
 session={user:{id:'actual-owner'}};await route.GET();assert.deepEqual(calls[0],['read','actual-owner']);
 assert.equal((await post({action:'grant',userId:'other',quantity:999})).status,400);
 assert.equal((await post({action:'favorite',cardNo:'001',favorite:true,userId:'other'})).status,200);assert.deepEqual(calls.at(-1),['favorite','actual-owner','001',true]);
 await post({action:'save',userId:'other',name:'Deck',cards:{}});assert.equal(calls.at(-1)[1],'actual-owner');
 assert.equal((await post({action:'delete',id:'x',version:-1})).status,400);
 assert.equal((await post({action:'save',name:'x'.repeat(21000)})).status,413);
 assert.equal((await route.POST(new Request('https://test',{method:'POST',body:'{oops'}))).status,400);
 console.log('Collection API: authentication, session-owned reads/writes, no grant/spend endpoint, input and size guards passed');
})().catch(error=>{console.error(error);process.exitCode=1});
