import {getServerSession} from 'next-auth';
import {notFound,redirect} from 'next/navigation';
import {authOptions} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {readGameAppearance} from '@/lib/game-profile-store';
import {defaultGameAppearance} from '@/lib/game-profile-options';
import {getLocalProfileByUserId} from '@/lib/local-profile-store';
import {rankForWins} from '@/lib/triad-room-store';
import GamePlayerProfile from '@/components/GamePlayerProfile';

export default async function PlayerGameProfile({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const session=await getServerSession(authOptions);
 if(!session?.user?.id)redirect('/game/login?callbackUrl='+encodeURIComponent('/game/profile/'+encodeURIComponent(id)));
 if(id===session.user.id)redirect('/game/profile');
 const user=await prisma.user.findUnique({where:{id},select:{id:true,name:true,image:true}});
 if(!user)notFound();
 const [appearance,stats,profile]=await Promise.allSettled([
  readGameAppearance(id),
  prisma.$queryRawUnsafe<{wins:number;losses:number}[]>('SELECT "wins","losses" FROM "TriadRankProfile" WHERE "userId"=$1',id),
  getLocalProfileByUserId(id),
 ]);
 const result=stats.status==='fulfilled'?(stats.value[0]||{wins:0,losses:0}):null;
 const rank=rankForWins(result?.wins||0);
 return <GamePlayerProfile user={{id:user.id,name:(profile.status==='fulfilled'&&profile.value?.displayName)||user.name||'PLAYER',image:user.image||'/avatar.png'}} initial={appearance.status==='fulfilled'?appearance.value:defaultGameAppearance} stats={result} rank={{name:rank.rankName,nextWins:rank.nextRankWins,nextName:rank.nextRankWins?rankForWins(rank.nextRankWins).rankName:null}} available={appearance.status==='fulfilled'} readOnly/>;
}
