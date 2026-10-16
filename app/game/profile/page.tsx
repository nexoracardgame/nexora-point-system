"use client";
import {useEffect,useState} from 'react';
import {useSession} from 'next-auth/react';
import {useRouter} from 'next/navigation';
import GamePlayerProfile from '@/components/GamePlayerProfile';
import {defaultGameAppearance} from '@/lib/game-profile-options';
import {cachedGameProfile,loadGameProfile,type GameProfileDetails} from '@/lib/game-profile-client';
export default function GameProfilePage(){
 const {data:session,status}=useSession(),router=useRouter(),id=session?.user?.id||'';
 const [details,setDetails]=useState<GameProfileDetails|null>(()=>cachedGameProfile(id)||null);
 useEffect(()=>{if(status==='unauthenticated'){router.replace('/game/login?callbackUrl=%2Fgame%2Fprofile');return}if(!id)return;let disposed=false;const cached=cachedGameProfile(id);setDetails(cached||null);void loadGameProfile(id).then(value=>{if(!disposed)setDetails(value)}).catch(()=>{});return()=>{disposed=true}},[id,status,router]);
 return <GamePlayerProfile key={`${id}-${Boolean(details)}`} user={{id,name:session?.user?.name||'PLAYER',image:session?.user?.image||'/avatar.png'}} initial={details?.appearance||defaultGameAppearance} stats={details?.stats||null} rank={details?.rank||{name:'—',nextWins:null,nextName:null}} available={details?.available||false} pending={!details}/>;
}
