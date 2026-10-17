"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {useSession} from 'next-auth/react';
import {usePathname} from 'next/navigation';
import {cachedGameProfile,loadGameProfile,warmGameProfile,type GameProfileDetails} from '@/lib/game-profile-client';
import GamePlayerProfile from './GamePlayerProfile';
import GameBackControl from './GameBackControl';
import './GameProfileOverlay.css';

export default function GameProfileOverlay(){
 const {data:session,status}=useSession(),pathname=usePathname();
 const [id,setId]=useState(''),[closing,setClosing]=useState(false),[entry,setEntry]=useState<{id:string;value:GameProfileDetails}|null>(null),[error,setError]=useState('');
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),previous=useRef<HTMLElement|null>(null),panel=useRef<HTMLElement>(null);
 const close=useCallback(()=>{setClosing(true);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{setId('');setClosing(false);previous.current?.focus()},180)},[]);
 useEffect(()=>{if(status==='authenticated'&&session?.user?.id)void warmGameProfile(session.user.id)},[status,session?.user?.id]);
 useEffect(()=>{
  const open=(event:Event)=>{if(status!=='authenticated')return;const value=(event as CustomEvent<{id:string}>).detail?.id||session?.user?.id;if(typeof value!=='string'||!value||value.length>200)return;if(timer.current)clearTimeout(timer.current);previous.current=document.activeElement as HTMLElement;setClosing(false);setError('');setId(value)};
  const link=(event:MouseEvent)=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||status!=='authenticated')return;const anchor=(event.target as Element)?.closest?.('a[href]');if(!(anchor instanceof HTMLAnchorElement)||anchor.target||anchor.hasAttribute('download'))return;const url=new URL(anchor.href);if(url.origin!==location.origin)return;const match=url.pathname.match(/^\/game\/profile(?:\/([^/]+))?\/?$/);if(!match)return;event.preventDefault();event.stopPropagation();open(new CustomEvent('open',{detail:{id:match[1]?decodeURIComponent(match[1]):session?.user?.id}}))};
  window.addEventListener('nexora:open-game-profile',open);document.addEventListener('click',link,true);
  return()=>{window.removeEventListener('nexora:open-game-profile',open);document.removeEventListener('click',link,true)};
 },[status,session?.user?.id]);
 useEffect(()=>{setId('');return()=>{if(timer.current)clearTimeout(timer.current)}},[pathname,session?.user?.id]);
 useEffect(()=>{
  if(!id)return;let disposed=false;panel.current?.focus();setError('');
  void loadGameProfile(id).then(value=>{if(!value.user||!value.stats||!value.available)throw Error('Incomplete profile');if(!disposed)setEntry({id,value})}).catch(()=>{if(!disposed)setError('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่')});
  const key=(event:KeyboardEvent)=>{if(document.querySelector('.gpp-dialog'))return;if(event.key==='Escape'){event.preventDefault();close()}if(event.key==='Tab'&&panel.current){const items=[...panel.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length),first=items[0],last=items.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){event.preventDefault();last?.focus()}else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===panel.current)){event.preventDefault();first?.focus()}}};
  const back=(event:Event)=>{event.preventDefault();close()};
  window.addEventListener('keydown',key);window.addEventListener('nexora:navigate-back',back);
  return()=>{disposed=true;window.removeEventListener('keydown',key);window.removeEventListener('nexora:navigate-back',back)};
 },[id,close]);
 useEffect(()=>{if(entry?.id===id)panel.current?.focus()},[entry,id]);
 if(!id||status!=='authenticated')return null;
 const details=entry?.id===id?entry.value:cachedGameProfile(id),own=id===session?.user?.id;
 if(!details?.user||!details.stats||!details.available)return error?<p className="gpp-toast" role="alert">{error}</p>:null;
 return <section ref={panel} tabIndex={-1} className="nexora-profile-overlay" data-closing={closing} role="dialog" aria-modal="true" aria-label="โปรไฟล์เกม"><GameBackControl onBack={close}/><GamePlayerProfile key={id} user={details.user} initial={details.appearance} stats={details.stats} rank={details.rank} available={details.available} readOnly={!own}/>{error&&<p className="gpp-toast" role="alert">{error}</p>}</section>;
}
