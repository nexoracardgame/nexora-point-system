import {getServerSession} from 'next-auth';
import {redirect} from 'next/navigation';
import {authOptions} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {readGameAppearance} from '@/lib/game-profile-store';
import {defaultGameAppearance} from '@/lib/game-profile-options';
import GamePlayerProfile from '@/components/GamePlayerProfile';
import {rankForWins} from '@/lib/triad-room-store';

export default async function GameProfilePage(){
 const session=await getServerSession(authOptions);if(!session?.user?.id)redirect('/game/login?callbackUrl=%2Fgame%2Fprofile');
 let appearance={...defaultGameAppearance},available=true,stats:{wins:number;losses:number}|null=null;
 try{appearance=await readGameAppearance(session.user.id)}catch{available=false}
 try{const rows=await prisma.$queryRawUnsafe<{wins:number;losses:number}[]>('SELECT "wins","losses" FROM "TriadRankProfile" WHERE "userId"=$1',session.user.id);stats=rows[0]||{wins:0,losses:0}}catch{}
 const rank=rankForWins(stats?.wins||0);
 return <GamePlayerProfile user={{id:session.user.id,name:session.user.name||'PLAYER',image:session.user.image||'/avatar.png'}} initial={appearance} stats={stats} rank={{name:rank.rankName,nextWins:rank.nextRankWins,nextName:rank.nextRankWins?rankForWins(rank.nextRankWins).rankName:null}} available={available}/>;
}
