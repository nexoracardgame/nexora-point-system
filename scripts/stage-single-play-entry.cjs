const {execFileSync}=require('node:child_process');
const file='app/(main)/battle/triad-dominion/TriadDominionClient.tsx';let source=execFileSync('git',['show','HEAD:'+file],{encoding:'utf8'});
const old='<GameLobbyNavigation onRank={() => setPanel("rank")} onHome={() => { setPanel(null); setPanelClosing(false); }} />';
if(!source.includes(old))throw Error('Expected previous lobby navigation');
source=source.replace(old,'<GameLobbyNavigation onRank={() => setPanel("rank")} onJoin={() => openPanel("join")} onHome={() => { setPanel(null); setPanelClosing(false); }} />');
for(const line of ['        <LobbyActionButton artwork="join" title="JOIN ARENA" subtitle="เข้าร่วม / ชมการต่อสู้" onClick={() => openPanel("join")} />','        <LobbyActionButton artwork="rank" title="DUELIST RANK" subtitle="อันดับนักดวล NEXORA" onClick={() => setPanel("rank")} />']){if(!source.includes(line))throw Error('Expected old action');source=source.replace(line+'\n','')}
const hash=execFileSync('git',['hash-object','-w','--stdin'],{input:source,encoding:'utf8'}).trim();execFileSync('git',['update-index','--cacheinfo',`100644,${hash},${file}`]);console.log('Staged only lobby action relocation');
