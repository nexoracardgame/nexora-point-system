import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {readGameAppearance} from '@/lib/game-profile-store';
import {defaultGameAppearance} from '@/lib/game-profile-options';
import {rankForWins} from '@/lib/triad-room-store';
import {getLocalProfileByUserId} from '@/lib/local-profile-store';
export async function GET(request:Request){
 const session=await getServerSession(authOptions);if(!session?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
 const id=new URL(request.url).searchParams.get('id')||session.user.id;
 if(id.length>200)return NextResponse.json({error:'Invalid player'},{status:400});
 const [appearance,stats,user,profile]=await Promise.allSettled([readGameAppearance(id),prisma.$queryRawUnsafe<{wins:number;losses:number}[]>('SELECT "wins","losses" FROM "TriadRankProfile" WHERE "userId"=$1',id),prisma.user.findUnique({where:{id},select:{id:true,name:true,image:true}}),getLocalProfileByUserId(id)]);
 if(user.status==='rejected')return NextResponse.json({error:'Profile unavailable'},{status:503});
 if(!user.value)return NextResponse.json({error:'Not found'},{status:404});
 const result=stats.status==='fulfilled'?(stats.value[0]||{wins:0,losses:0}):null,rank=rankForWins(result?.wins||0);
 return NextResponse.json({user:{id:user.value.id,name:(profile.status==='fulfilled'&&profile.value?.displayName)||user.value.name||'PLAYER',image:user.value.image||'/avatar.png'},appearance:appearance.status==='fulfilled'?appearance.value:defaultGameAppearance,available:appearance.status==='fulfilled',stats:result,rank:{name:rank.rankName,nextWins:rank.nextRankWins,nextName:rank.nextRankWins?rankForWins(rank.nextRankWins).rankName:null}},{headers:{'Cache-Control':'no-store'}});
}
