"use client";
import {useEffect,useState} from 'react';
import {useSession} from 'next-auth/react';
import {useRouter} from 'next/navigation';
import GamePlayerProfile from '@/components/GamePlayerProfile';
import {cachedGameProfile,loadGameProfile,type GameProfileDetails} from '@/lib/game-profile-client';
export default function GameProfilePage(){
 const {data:session,status}=useSession(),router=useRouter(),id=session?.user?.id||'';
 const [entry,setEntry]=useState<{id:string;value:GameProfileDetails}|null>(null),[error,setError]=useState('');
 const details=entry?.id===id?entry.value:cachedGameProfile(id);
 useEffect(()=>{if(status==='unauthenticated'){router.replace('/game/login?callbackUrl=%2Fgame%2Fprofile');return}if(status!=='authenticated'||!id)return;let disposed=false;setError('');void loadGameProfile(id).then(value=>{if(!disposed)setEntry({id,value})}).catch(()=>{if(!disposed)setError('โหลดข้อมูลโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่')});return()=>{disposed=true}},[id,status,router]);
 if(status!=='authenticated'||!details?.user||!details.stats||!details.available)return error?<p role="alert">{error}</p>:null;
 return <GamePlayerProfile key={id} user={details.user} initial={details.appearance} stats={details.stats} rank={details.rank} available={details.available}/>;
}
