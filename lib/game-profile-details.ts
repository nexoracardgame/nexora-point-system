import {prisma} from '@/lib/prisma';
import {readGameAppearance} from '@/lib/game-profile-store';
import {rankForWins,readTriadRankStats} from '@/lib/triad-room-store';
import {getLocalProfileByUserId} from '@/lib/local-profile-store';
import type {GameProfileDetails} from './game-profile-client';

export async function readGameProfileDetails(id:string):Promise<GameProfileDetails|null>{
 const [appearance,stats,user,profile]=await Promise.all([
  readGameAppearance(id),
  readTriadRankStats(id),
  prisma.user.findUnique({where:{id},select:{id:true,name:true,image:true}}),
  getLocalProfileByUserId(id).catch(()=>null),
 ]);
 if(!user)return null;
 const rank=rankForWins(stats.wins);
 return {user:{id:user.id,name:profile?.displayName||user.name||'PLAYER',image:user.image||'/avatar.png'},appearance,available:true,stats,rank:{name:rank.rankName,nextWins:rank.nextRankWins,nextName:rank.nextRankWins?rankForWins(rank.nextRankWins).rankName:null}};
}
