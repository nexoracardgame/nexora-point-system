"use client";

import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {Check,Clock3,Shield,UserPlus,Users,X} from 'lucide-react';
import {cachedGameProfile,loadGameProfile,type GameProfileDetails} from '@/lib/game-profile-client';
import './BattlePlayerProfile.css';

export type BattlePlayerIdentity={id?:string;name:string;image?:string};
export type BattlePlayerRank={rankName:string;wins:number;losses:number};

function FriendAction({id}:{id:string}){
 const [relation,setRelation]=useState('checking'),[requestId,setRequestId]=useState<string|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const pending=useRef(false);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setRelation('checking');setError('');
  void fetch('/api/community/status/'+encodeURIComponent(id),{cache:'no-store',signal:controller.signal}).then(async response=>{
   if(!response.ok)throw Error('โหลดสถานะเพื่อนไม่สำเร็จ');const data=await response.json();
   if(controller.signal.aborted)return;
   if(!['none','friends','incoming','outgoing','self'].includes(data.relation?.status))throw Error('โหลดสถานะเพื่อนไม่สำเร็จ');
   setRelation(data.relation.status);setRequestId(data.relation.requestId||null);
  }).catch(()=>{if(!controller.signal.aborted){setRelation('error');setError('โหลดสถานะเพื่อนไม่สำเร็จ')}});
  return()=>controller.abort();
 },[id,retry]);
 const send=async()=>{
  if(pending.current||!['none','incoming'].includes(relation))return;
  pending.current=true;setBusy(true);setError('');
  try{
   const payload=relation==='incoming'?{action:'respond',requestId,decision:'accept'}:{action:'request',targetUserId:id};
   const response=await fetch('/api/community/friends',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const data=await response.json();if(!response.ok)throw Error(data.error||'เพิ่มเพื่อนไม่สำเร็จ');
   setRelation(data.relation?.status||(data.status==='accepted'?'friends':'outgoing'));setRequestId(data.relation?.requestId||null);
   window.dispatchEvent(new CustomEvent('nexora:friends-updated',{detail:{targetUserId:id}}));
  }catch(error){setError(error instanceof Error?error.message:'เพิ่มเพื่อนไม่สำเร็จ')}
  finally{pending.current=false;setBusy(false)}
 };
 if(relation==='self')return null;
 return <footer className="bpp-friend">
  {relation==='friends'?<span><Users size={16}/>เป็นเพื่อนแล้ว</span>:relation==='outgoing'?<span><Clock3 size={16}/>ส่งคำขอแล้ว</span>:relation==='error'?<button onClick={()=>setRetry(value=>value+1)}>ลองใหม่</button>:<button disabled={busy||relation==='checking'||(relation==='incoming'&&!requestId)} onClick={()=>void send()}>{relation==='incoming'?<Check size={16}/>:<UserPlus size={16}/>} {relation==='checking'?'กำลังตรวจสอบ…':busy?'กำลังส่ง…':relation==='incoming'?'รับเป็นเพื่อน':'เพิ่มเพื่อน'}</button>}
  {error&&<small role="alert">{error}</small>}
 </footer>;
}

export default function BattlePlayerProfile({identity,rank,player,currentUserId}:{identity:BattlePlayerIdentity;rank?:BattlePlayerRank|null;player?:boolean;currentUserId?:string}){
 const [open,setOpen]=useState(false),[details,setDetails]=useState<GameProfileDetails|null>(null);
 const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
 const [position,setPosition]=useState<CSSProperties>({visibility:'hidden'});
 const nameLabel=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{
  const node=nameLabel.current;if(!node)return;
  const fit=()=>{node.style.fontSize='';let size=parseFloat(getComputedStyle(node).fontSize);while(size>8&&(node.scrollWidth>node.clientWidth+1||size>node.clientHeight)){size-=.5;node.style.fontSize=`${size}px`}};
  fit();const observer=new ResizeObserver(fit);observer.observe(node);return()=>observer.disconnect();
 },[identity.name]);
 const bot=!identity.id||identity.id==='triad-bot-level-99'||identity.id==='pentad-bot';
 useEffect(()=>{
  setOpen(false);setDetails(identity.id?cachedGameProfile(identity.id)||null:null);
  if(bot)return;
  let active=true;
  void loadGameProfile(identity.id!).then(value=>{if(active)setDetails(value)}).catch(()=>{});
  return()=>{active=false};
 },[identity.id,bot]);
 useEffect(()=>{
  if(!open)return;
  let active=true;
  if(!bot){const cached=cachedGameProfile(identity.id!);if(cached)setDetails(cached);void loadGameProfile(identity.id!).then(value=>{if(active)setDetails(value)}).catch(()=>{})}
  const keyboard=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();setOpen(false);trigger.current?.focus()}};
  const outside=(event:PointerEvent)=>{const target=event.target as Node;if(!panel.current?.contains(target)&&!trigger.current?.contains(target))setOpen(false)};
  window.addEventListener('keydown',keyboard,true);
  document.addEventListener('pointerdown',outside,true);
  return()=>{active=false;window.removeEventListener('keydown',keyboard,true);document.removeEventListener('pointerdown',outside,true)};
 },[open,identity.id,bot]);
 useLayoutEffect(()=>{
  if(!open)return;
  let frame=0;
  const place=()=>{
   const anchor=trigger.current,node=panel.current;if(!anchor||!node)return;
   const rect=anchor.getBoundingClientRect(),safe=8,gap=6,width=node.offsetWidth,height=node.offsetHeight;
   let left=player?rect.right-width:rect.left,top=rect.bottom+gap;
   if(top+height>window.innerHeight-safe&&rect.top-height-gap>=safe)top=rect.top-height-gap;
   left=Math.max(safe,Math.min(left,window.innerWidth-width-safe));top=Math.max(safe,Math.min(top,window.innerHeight-height-safe));
   setPosition({left,top,visibility:'visible'});
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(place)};
  place();const observer=new ResizeObserver(schedule);if(panel.current)observer.observe(panel.current);if(trigger.current)observer.observe(trigger.current);
  window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true)};
 },[open,player]);
 const stats=details?.stats||rank;
 const name=details?.user?.name||identity.name;
 const image=details?.appearance.avatar||details?.user?.image||identity.image||'/avatar.png';
 const rankName=bot?'BOT':details?.rank.name||rank?.rankName;
 const wins=stats?.wins,losses=stats?.losses;
 const rate=wins!==undefined&&losses!==undefined?(wins+losses?Math.round(wins/(wins+losses)*100):0):null;
 return <>
  <button ref={trigger} className="battle-player-identity" data-player={Boolean(player)} aria-label={`ดูโปรไฟล์ ${identity.name}`} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(value=>!value)} onPointerEnter={()=>{if(!bot)void loadGameProfile(identity.id!).catch(()=>{})}}>
   <span className="bpi-avatar"><img src={image} alt=""/><img className="bpi-avatar-frame" src="/images/lobby-play/profile-avatar-frame.png" alt=""/></span>
   <span className="bpi-copy"><img className="bpi-name-frame" src="/images/lobby-play/profile-name-frame.png" alt=""/><strong ref={nameLabel} title={identity.name}>{identity.name}</strong></span>
   <span className="bpi-rank"><img src="/images/lobby-play/profile-rank-label.png" alt=""/><span>{rankName||'—'}</span></span>
  </button>
  {open&&createPortal(<div ref={panel} role="dialog" aria-modal="false" className="battle-player-mini" style={position} aria-label={`โปรไฟล์ ${identity.name}`} onKeyDown={event=>event.stopPropagation()}>
   <header><span><Shield size={16}/>โปรไฟล์ผู้เล่น</span><button aria-label="ปิดโปรไฟล์" onClick={()=>{setOpen(false);trigger.current?.focus()}}><X size={19}/></button></header>
   <div className="bpp-identity"><span className="bpp-avatar"><img src={image} alt=""/><img src="/images/lobby-play/profile-avatar-frame.png" alt=""/></span><div><h2>{name}</h2><p><Shield size={15}/>{rankName||'—'}</p></div></div>
   {bot?<p className="bpp-bot">คู่ฝึกซ้อม AI · ไม่จัดอันดับผู้เล่น</p>:<div className="bpp-stats"><div><small>ชนะ</small><strong>{wins?.toLocaleString()??'—'}</strong></div><div><small>แพ้</small><strong>{losses?.toLocaleString()??'—'}</strong></div><div><small>อัตราชนะ</small><strong>{rate===null?'—':rate+'%'}</strong></div></div>}
   {!bot&&details?.rank.nextWins!=null&&<p className="bpp-progress">อีก {Math.max(0,details.rank.nextWins-(wins||0)).toLocaleString()} ชัยชนะ สู่ {details.rank.nextName}</p>}
   {!bot&&identity.id!==currentUserId&&<FriendAction key={identity.id} id={identity.id!}/>}
  </div>,document.body)}
 </>;
}
