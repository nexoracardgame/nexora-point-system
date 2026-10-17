import type {Metadata} from 'next';
import GameCoinShop from '@/components/GameCoinShop';
import {getServerSession} from 'next-auth';
import {redirect} from 'next/navigation';
import {authOptions} from '@/lib/auth';
import {gameCoinPackages} from '@/lib/game-coin-packages';

export const metadata:Metadata={title:{absolute:'เติม COIN | NEXORA CARD GAME'}};

export default async function GameTopupPage({searchParams}:{searchParams:Promise<{pack?:string}>}){
 const session=await getServerSession(authOptions);
 if(!session?.user?.id){const query=await searchParams;const pack=gameCoinPackages.find(item=>item.id===query.pack);redirect('/game/login?callbackUrl='+encodeURIComponent('/game/topup'+(pack?'?pack='+pack.id:'')))}
 return <GameCoinShop/>;
}
