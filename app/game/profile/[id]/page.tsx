"use client";
import {useEffect,useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import {useSession} from 'next-auth/react';
import GamePlayerProfile from '@/components/GamePlayerProfile';
import {defaultGameAppearance} from '@/lib/game-profile-options';
import {cachedGameIdentity,cachedGameProfile,loadGameProfile,type GameProfileDetails} from '@/lib/game-profile-client';

export default function PlayerGameProfile(){
 const {id}=useParams<{id:string}>(),router=useRouter();
 const {data:session,status}=useSession();
 const [entry,setEntry]=useState<{id:string;details:GameProfileDetails}|null>(()=>{const details=cachedGameProfile(id);return details?{id,details}:null});
 const [error,setError]=useState('');
 const details=entry?.id===id?entry.details:cachedGameProfile(id);
 const user=details?.user||cachedGameIdentity(id)||{id,name:'PLAYER',image:'/avatar.png'};
 useEffect(()=>{
  if(status==='unauthenticated'){router.replace('/game/login?callbackUrl='+encodeURIComponent('/game/profile/'+encodeURIComponent(id)));return}
  if(status!=='authenticated')return;
  if(id===session?.user?.id){router.replace('/game/profile');return}
  let disposed=false;setError('');
  void loadGameProfile(id).then(details=>{if(!disposed)setEntry({id,details})}).catch(()=>{if(!disposed)setError('โหลดข้อมูลผู้เล่นไม่สำเร็จ กรุณาลองใหม่')});
  return()=>{disposed=true};
 },[id,status,session?.user?.id,router]);
 return <><GamePlayerProfile key={`${id}-${Boolean(details)}`} user={user} initial={details?.appearance||defaultGameAppearance} stats={details?.stats||null} rank={details?.rank||{name:'—',nextWins:null,nextName:null}} available={details?.available||false} pending={!details} readOnly/>{error&&<p className="gpp-toast" role="alert">{error}</p>}</>;
}
