"use client";
import {useEffect} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {useSession} from 'next-auth/react';
import { isBattleRoomExiting } from '@/lib/battle-room-exit';
export default function GameRoomResume(){
 const pathname=usePathname(),router=useRouter(),{data:session,status}=useSession();
 useEffect(()=>{if(status!=='authenticated'||pathname==='/game/login')return;let stopped=false,running=false;const controller=new AbortController();
  const check=async()=>{if(running||document.hidden)return;const requestedAt=location.href;running=true;try{const r=await fetch('/api/game-room/active',{cache:'no-store',signal:controller.signal});if(!r.ok)return;const {room}=await r.json();if(stopped||requestedAt!==location.href||!room||!/^\d{6}$/.test(room.code)||isBattleRoomExiting(room.mode,room.code))return;const explicitRoom=new URLSearchParams(location.search).get('room');if((pathname==='/game/heptad'||pathname==='/game/pentad')&&/^\d{6}$/.test(explicitRoom||''))return;if(room.mode==='pentad'||room.mode==='heptad'){const path=`/game/${room.mode}`;if(pathname!==path||explicitRoom!==room.code)router.replace(`${path}?room=${room.code}`)}else if(pathname!=='/game')router.replace('/game');}catch{}finally{running=false}};
  void check();const timer=setInterval(()=>void check(),4000);window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);return()=>{stopped=true;controller.abort();clearInterval(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check)};
 },[pathname,router,status,session?.user?.id]);return null;
}
