import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {readGameAppearance} from '@/lib/game-profile-store';
import {defaultGameAppearance} from '@/lib/game-profile-options';
import {rankForWins} from '@/lib/triad-room-store';
export async function GET(){
 const session=await getServerSession(authOptions);if(!session?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
 const [appearance,stats]=await Promise.allSettled([readGameAppearance(session.user.id),prisma.$queryRawUnsafe<{wins:number;losses:number}[]>('SELECT "wins","losses" FROM "TriadRankProfile" WHERE "userId"=$1',session.user.id)]);
 const result=stats.status==='fulfilled'?(stats.value[0]||{wins:0,losses:0}):null,rank=rankForWins(result?.wins||0);
 return NextResponse.json({appearance:appearance.status==='fulfilled'?appearance.value:defaultGameAppearance,available:appearance.status==='fulfilled',stats:result,rank:{name:rank.rankName,nextWins:rank.nextRankWins,nextName:rank.nextRankWins?rankForWins(rank.nextRankWins).rankName:null}},{headers:{'Cache-Control':'no-store'}});
}
