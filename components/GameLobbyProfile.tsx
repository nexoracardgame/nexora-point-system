"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {gameFrames,type GameAppearance} from '@/lib/game-profile-options';
import GameLobbyWallet from './GameLobbyWallet';
export default function GameLobbyProfile({name,image,rank,wins}:{name:string;image:string;rank:string;wins:number}){
 const [appearance,setAppearance]=useState<GameAppearance|null>(null);
 useEffect(()=>{const controller=new AbortController();void fetch('/api/game-profile',{signal:controller.signal,cache:'no-store'}).then(r=>r.ok?r.json():null).then(value=>{if(!controller.signal.aborted)setAppearance(value)}).catch(()=>{});return()=>controller.abort()},[]);
 const color=gameFrames.find(f=>f.id===appearance?.frame)?.color||'#d7b777';
 return <><GameLobbyWallet/><Link href="/game/profile" className="nexora-command-profile" aria-label="เปิดโปรไฟล์ของฉัน" title="เปิดโปรไฟล์ของฉัน" style={{color:'inherit',textDecoration:'none'}}><img src={appearance?.avatar||image||'/avatar.png'} alt="" style={{borderRadius:'50%',borderColor:color,boxShadow:`0 0 12px ${color}33`}}/><div><strong>{name}</strong><small>{rank} · {wins} ชัยชนะ</small></div></Link></>;
}
