"use client";
import {useEffect} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {useSession} from 'next-auth/react';
export default function GameRoomResume(){
 const pathname=usePathname(),router=useRouter(),{data:session,status}=useSession();
 useEffect(()=>{if(status!=='authenticated'||pathname==='/game/login')return;let stopped=false,running=false;const controller=new AbortController();
  const check=async()=>{if(running||document.hidden)return;running=true;try{const r=await fetch('/api/game-room/active',{cache:'no-store',signal:controller.signal});if(!r.ok)return;const {room}=await r.json();if(stopped||!room||!/^\d{6}$/.test(room.code))return;if(room.mode==='pentad'){if(pathname!=='/game/pentad'||new URLSearchParams(location.search).get('room')!==room.code)router.replace(`/game/pentad?room=${room.code}`)}else if(pathname!=='/game')router.replace('/game');}catch{}finally{running=false}};
  void check();const timer=setInterval(()=>void check(),4000);window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);return()=>{stopped=true;controller.abort();clearInterval(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check)};
 },[pathname,router,status,session?.user?.id]);return null;
}
