const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const code=ts.transpileModule(fs.readFileSync('lib/game-patcher.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
let installed=null,reads=0;
const caches={open:async()=>({match:async url=>{reads++;return url==='/game/release-pointer'?(installed?{json:async()=>installed}:null):true}})};
const api={};new Function('exports','caches',code)(api,caches);
(async()=>{
 const base=JSON.parse(fs.readFileSync('public/game-release.json','utf8'));
 assert.equal(await api.hasPendingLobbyDownload(base),false,'Fresh web session is not an update');
 assert.equal(await api.hasPendingLobbyDownload({...base,version:'future-version'}),false,'Normal version change does not trigger download');
 assert.equal(reads,0,'Ordinary browsing does not scan resource caches');
 for(const kind of ['critical-patch','addon']){
 const release={...base,manualDownload:{kind,title:'Optional content'}};
 installed=null;assert.equal(await api.hasPendingLobbyDownload(release),true,kind+' can be announced');
 installed={version:release.version,cacheName:'installed',hashes:Object.fromEntries(release.resources.map(r=>[r.url,r.sha256]))};
 assert.equal(await api.hasPendingLobbyDownload(release),false,'Already installed '+kind+' is hidden');
 }
 for(const manualDownload of [{kind:'base-game',title:'Game'},{kind:'addon',title:''}])assert.equal(await api.hasPendingLobbyDownload({...base,manualDownload}),false);
 assert.equal(await api.hasPendingLobbyDownload({...base,manualDownload:{kind:'addon',title:'Pack'},resources:[]}),false);
 console.log('Lobby download policy passed: no base game/cache prompt; explicit critical patch/addon only; installed packages hidden');
})().catch(e=>{console.error(e);process.exitCode=1});
