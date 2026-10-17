import {prisma} from '@/lib/prisma';
import {readGameAppearance} from '@/lib/game-profile-store';
import {rankForWins} from '@/lib/triad-room-store';
import {getLocalProfileByUserId} from '@/lib/local-profile-store';
import type {GameProfileDetails} from './game-profile-client';

export async function readGameProfileDetails(id:string):Promise<GameProfileDetails|null>{
 const [appearance,rows,user,profile]=await Promise.all([
  readGameAppearance(id),
  prisma.$queryRawUnsafe<{wins:number;losses:number}[]>('SELECT "wins","losses" FROM "TriadRankProfile" WHERE "userId"=$1',id),
  prisma.user.findUnique({where:{id},select:{id:true,name:true,image:true}}),
  getLocalProfileByUserId(id).catch(()=>null),
 ]);
 if(!user)return null;
 const stats=rows[0]||{wins:0,losses:0},rank=rankForWins(stats.wins);
 return {user:{id:user.id,name:profile?.displayName||user.name||'PLAYER',image:user.image||'/avatar.png'},appearance,available:true,stats,rank:{name:rank.rankName,nextWins:rank.nextRankWins,nextName:rank.nextRankWins?rankForWins(rank.nextRankWins).rankName:null}};
}
