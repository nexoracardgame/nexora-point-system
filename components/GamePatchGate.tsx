"use client";

import { useEffect, useRef, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useBattleArenaActive } from '@/lib/battle-ui-state';
import { installGameResources,type GameRelease,type PatchProgress } from '@/lib/game-patcher';
import './GamePatchGate.css';
import './BattleLoadingScreen.css';
import {loadLobbyAssets} from '@/lib/lobby-assets';
const preparedUsers=new Set<string>();

export default function GamePatchGate({children}:{children:React.ReactNode}){
  const {status,data:session}=useSession();
  const userId=session?.user?.id||'';
  const pathname=usePathname();
  const canPatch=status==='authenticated'&&pathname!=='/game/login';
  const [blocking,setBlocking]=useState(!preparedUsers.has(userId)),[progress,setProgress]=useState<PatchProgress|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [updating,setUpdating]=useState(false);
  const active=useBattleArenaActive(),activeRef=useRef(active);activeRef.current=active;
  useEffect(()=>{
    if(status==='unauthenticated'){preparedUsers.clear();return;}
    if(!canPatch||!userId)return;
    if(preparedUsers.has(userId)&&retry===0){setBlocking(false);return;}
    const ready=()=>{preparedUsers.add(userId);setBlocking(false)};
    const desktop=(window as typeof window&{nexoraDesktop?:{isGameDesktop?:boolean;getVersion:()=>Promise<string>}}).nexoraDesktop;
    if(!desktop?.isGameDesktop){let disposed=false;setError('');void loadLobbyAssets().then(()=>{if(!disposed)ready()}).catch(()=>{if(!disposed)setError('โหลดทรัพยากรเกมไม่สำเร็จ')});return()=>{disposed=true};}
    document.documentElement.dataset.gameDesktop='true';
    let disposed=false,running=false;const controller=new AbortController();
    const check=async()=>{
      if(running||activeRef.current)return;running=true;
      try{
        const response=await fetch('/game-release.json',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('ตรวจสอบแพตช์ไม่สำเร็จ');
        const release=await response.json() as GameRelease;
        const current=await (await caches.open('nexora-game-release')).match('/game/release-pointer');const previous=current?await current.json():null;
        const version=await desktop.getVersion();
        const numbers=(v:string)=>v.split('.').map(Number);const v=numbers(version),minimum=numbers(release.minimumDesktopVersion);
        if(v.some((n,i)=>n<minimum[i]&&v.slice(0,i).every((p,j)=>p===minimum[j])))throw Error('กรุณาอัปเดตตัวเกม Windows เป็นเวอร์ชันล่าสุด');
        if(previous?.version===release.version){await loadLobbyAssets();if(!disposed)ready();return;}
        if(disposed||activeRef.current)return;
        setBlocking(true);setUpdating(true);setError('');
        await installGameResources(release,p=>{if(!disposed)setProgress(p)},controller.signal);
        if(disposed)return;
        if(previous && previous.authEpoch!==release.authEpoch){await signOut({callbackUrl:'/game/login'});return;}
        await loadLobbyAssets();if(!disposed)ready();
      }catch(err){if(!disposed){setBlocking(true);setError(err instanceof Error?err.message:'โหลดแพตช์ไม่สำเร็จ')}}finally{running=false}
    };
    void check();
    return()=>{disposed=true;controller.abort()};
  },[retry,canPatch,userId,status]);
  if(pathname==='/game/profile'||pathname?.startsWith('/game/profile/')||pathname==='/game/login'||status==='unauthenticated'||(!blocking&&status==='authenticated'))return children;
  if(!updating)return <div className="nexora-game-entry nexora-game-loading" role="status" aria-label="กำลังเตรียมเกม"><div className="nexora-game-loading-wallpaper" /><div className="nexora-game-loading-content"><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME" /><div className="nexora-game-loading-track" role="progressbar" aria-label="กำลังโหลดเกม"><div /></div>{error&&<><p>{error}</p><button onClick={()=>setRetry(n=>n+1)}>ลองอีกครั้ง</button></>}</div></div>;
  const percent=progress?Math.min(progress.completed===progress.count?100:99,Math.floor(progress.downloaded/progress.total*100)):0;
  return <div className="nexora-game-patch" role="status"><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME" /><h1>{error?'อัปเดตไม่สำเร็จ':'กำลังอัปเดตทรัพยากรเกม'}</h1><p>{error||progress?.file||'ตรวจสอบแพตช์'}</p><progress max={100} value={percent} aria-label="ดาวน์โหลดแพตช์" /><strong>{percent}%</strong>{progress&&<small>{(progress.downloaded/1048576).toFixed(1)} / {(progress.total/1048576).toFixed(1)} MB · {progress.completed}/{progress.count} ไฟล์</small>}{error&&<button onClick={()=>setRetry(n=>n+1)}>ลองอีกครั้ง</button>}</div>;
}
