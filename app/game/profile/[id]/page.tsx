"use client";
import {useEffect,useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import {useSession} from 'next-auth/react';
import GamePlayerProfile from '@/components/GamePlayerProfile';
import {cachedGameProfile,loadGameProfile,type GameProfileDetails} from '@/lib/game-profile-client';

export default function PlayerGameProfile(){
 const {id}=useParams<{id:string}>(),router=useRouter();
 const {data:session,status}=useSession();
 const [entry,setEntry]=useState<{id:string;details:GameProfileDetails}|null>(()=>{const details=cachedGameProfile(id);return details?{id,details}:null});
 const [error,setError]=useState('');
 const details=entry?.id===id?entry.details:cachedGameProfile(id);
 useEffect(()=>{
  if(status==='unauthenticated'){router.replace('/game/login?callbackUrl='+encodeURIComponent('/game/profile/'+encodeURIComponent(id)));return}
  if(status!=='authenticated')return;
  if(id===session?.user?.id){router.replace('/game/profile');return}
  let disposed=false;setError('');
  void loadGameProfile(id).then(details=>{if(!disposed)setEntry({id,details})}).catch(()=>{if(!disposed)setError('โหลดข้อมูลผู้เล่นไม่สำเร็จ กรุณาลองใหม่')});
  return()=>{disposed=true};
 },[id,status,session?.user?.id,router]);
 if(status!=='authenticated'||!details?.user||!details.stats||!details.available)return error?<p role="alert">{error}</p>:null;
 return <><GamePlayerProfile key={id} user={details.user} initial={details.appearance} stats={details.stats} rank={details.rank} available={details.available} readOnly/>{error&&<p className="gpp-toast" role="alert">{error}</p>}</>;
}
