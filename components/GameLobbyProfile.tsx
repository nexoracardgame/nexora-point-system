"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {createPortal} from 'react-dom';
import {useSession} from 'next-auth/react';
import {useRouter} from 'next/navigation';
import {loadGameProfile} from '@/lib/game-profile-client';
import {gameHeroes} from '@/lib/game-profile-options';
import {type GameAppearance} from '@/lib/game-profile-options';
import {Shield} from 'lucide-react';
import GameLobbyWallet from './GameLobbyWallet';
import './GameLobbyProfile.css';
export default function GameLobbyProfile({name,image,rank,wins}:{name:string;image:string;rank:string;wins:number}){
 const [appearance,setAppearance]=useState<GameAppearance|null>(null);
 const {data:session}=useSession();const router=useRouter();
 useEffect(()=>{router.prefetch('/game/profile');if(session?.user?.id)void loadGameProfile(session.user.id).catch(()=>{});gameHeroes.forEach(hero=>{const img=new Image();img.src=hero.image})},[router,session?.user?.id]);
 const [notice,setNotice]=useState(false);
 const nameLabel=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{const label=nameLabel.current;if(!label)return;const fit=()=>{label.style.fontSize='';let size=parseFloat(getComputedStyle(label).fontSize);while(size>8&&label.scrollWidth>label.clientWidth+1){size-=.5;label.style.fontSize=`${size}px`}};const observer=new ResizeObserver(fit);observer.observe(label);fit();return()=>observer.disconnect()},[name]);
 useEffect(()=>{const controller=new AbortController();void fetch('/api/game-profile',{signal:controller.signal,cache:'no-store'}).then(r=>r.ok?r.json():null).then(value=>{if(!controller.signal.aborted)setAppearance(value)}).catch(()=>{});return()=>controller.abort()},[]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(false),3000);return()=>clearTimeout(timer)},[notice]);
 return <><GameLobbyWallet/><section className="nexora-lobby-identity" aria-label="โปรไฟล์ผู้เล่น" data-rank={rank.toLowerCase()}>
  <img className="nli-avatar" src={appearance?.avatar||image||'/avatar.png'} alt=""/>
  <span className="nli-art nli-pieces" aria-hidden="true"><img className="nli-piece-avatar" src="/images/lobby-play/profile-avatar-frame.png" alt=""/><img className="nli-piece-name" src="/images/lobby-play/profile-name-frame.png" alt=""/><img className="nli-piece-rank" src="/images/lobby-play/profile-rank-frame.png" alt=""/><img className="nli-piece-label" src="/images/lobby-play/profile-rank-label.png" alt=""/><img className="nli-piece-edit" src="/images/lobby-play/profile-edit.png" alt=""/></span>
  <Link className="nli-profile-link" href="/game/profile" aria-label="เปิดโปรไฟล์ของฉัน" title={name}/>
  <strong ref={nameLabel} className="nli-name" title={name}>{name}</strong>
  <span className="nli-rank-badge" title={rank}><Shield aria-hidden="true"/></span>
  <span className="nli-rank-name" title={`${rank} · ${wins} ชัยชนะ`}>{rank}</span>
  <button type="button" className="nli-edit" aria-label="แก้ไขชื่อผู้เล่น" title="แก้ไขชื่อผู้เล่น · ยังไม่เปิดให้บริการ" onClick={()=>setNotice(true)}/>
  {notice&&createPortal(<span className="nli-notice" role="status">แก้ไขชื่อผู้เล่น · ยังไม่เปิดให้บริการ</span>,document.body)}
 </section></>;
}
