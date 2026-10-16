const {execFileSync}=require('node:child_process');
const file='app/(main)/battle/triad-dominion/TriadDominionClient.tsx';
let source=execFileSync('git',['show','HEAD:'+file],{encoding:'utf8'});
const old='<div className="nexora-command-profile"><img src={participant.image || "/avatar.png"} alt="" /><div><strong>{participant.name}</strong><small>{profile?.rankName || "BRONZE"} · {profile?.wins || 0} ชัยชนะ</small></div></div>';
if(!source.includes(old))throw Error('Expected original profile entry');
source=source.replace("import GameLobbyNavigation from '@/components/GameLobbyNavigation';","import GameLobbyNavigation from '@/components/GameLobbyNavigation';\nimport GameLobbyProfile from '@/components/GameLobbyProfile';").replace(old,'<GameLobbyProfile name={participant.name} image={participant.image || "/avatar.png"} rank={profile?.rankName || "BRONZE"} wins={profile?.wins || 0} />');
const hash=execFileSync('git',['hash-object','-w','--stdin'],{input:source,encoding:'utf8'}).trim();
execFileSync('git',['update-index','--cacheinfo',`100644,${hash},${file}`]);
console.log('Staged only profile import and lobby entry; unrelated arena work preserved');
