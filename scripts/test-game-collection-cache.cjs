const assert=require('node:assert/strict'),load=require('./game-collection-test-loader.cjs')();
const api=load('lib/game-collection-client.ts'),original=global.fetch,requests=[];
global.fetch=(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}));
const reply=(index,data,ok=true)=>requests[index].resolve({ok,json:async()=>structuredClone(data)});
const initial={owned:[],decks:[],wallet:{nexPoint:0,coin:0}};
(async()=>{
 const first=api.loadGameCollection('a'),same=api.loadGameCollection('a');assert.equal(first,same);reply(0,initial);await first;
 await api.loadGameCollection('a');assert.equal(requests.length,1,'Fresh cache does not fetch twice');
 const stale=api.loadGameCollection('a',true),mutation=api.mutateGameCollection('a',{action:'save'});reply(2,{deck:{id:'new',name:'Saved'}});await mutation;reply(1,initial);assert.equal((await stale).decks[0].id,'new','Slow read cannot erase a saved deck');
 const second=api.loadGameCollection('b');reply(3,initial);await second;assert.equal(api.cachedGameCollection('b').decks.length,0,'Caches are owner scoped');
 const failure=api.loadGameCollection('a',true);reply(4,{error:'Offline'},false);await assert.rejects(failure,/Offline/);assert.equal(api.cachedGameCollection('a').decks[0].id,'new');
 console.log('Collection cache: deduplication, identity isolation, mutation/read race and offline retention passed');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>{global.fetch=original});
