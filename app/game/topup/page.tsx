import type {Metadata} from 'next';
import GameCoinShop from '@/components/GameCoinShop';

export const metadata:Metadata={title:{absolute:'เติม COIN | NEXORA CARD GAME'}};

export default function GameTopupPage(){return <GameCoinShop/>}
