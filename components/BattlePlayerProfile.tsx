"use client";

import {useEffect,useRef,useState} from 'react';
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
 const [open,setOpen]=useState(false),[details,setDetails]=useState<GameProfileDetails|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const trigger=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDialogElement>(null);
 const bot=!identity.id||identity.id==='triad-bot-level-99';
 useEffect(()=>{setOpen(false);setDetails(null);setError('')},[identity.id]);
 useEffect(()=>{
  if(!open)return;
  const node=dialog.current;if(!node)return;
  node.showModal();let active=true;
  if(!bot){setError('');setDetails(cachedGameProfile(identity.id!)||null);void loadGameProfile(identity.id!).then(value=>{if(active)setDetails(value)}).catch(()=>{if(active)setError('โหลดโปรไฟล์ไม่สำเร็จ')})}
  const keyboard=(event:KeyboardEvent)=>{event.stopImmediatePropagation();if(event.key==='Escape'){event.preventDefault();setOpen(false)}};
  window.addEventListener('keydown',keyboard,true);
  return()=>{active=false;window.removeEventListener('keydown',keyboard,true);node.close();trigger.current?.focus()};
 },[open,identity.id,bot,retry]);
 const stats=details?.stats||rank;
 const name=details?.user?.name||identity.name;
 const image=details?.appearance.avatar||details?.user?.image||identity.image||'/avatar.png';
 const rankName=bot?'BOT':details?.rank.name||rank?.rankName;
 const wins=stats?.wins,losses=stats?.losses;
 const rate=wins!==undefined&&losses!==undefined?(wins+losses?Math.round(wins/(wins+losses)*100):0):null;
 return <>
  <button ref={trigger} className="battle-player-identity" data-player={Boolean(player)} aria-label={`ดูโปรไฟล์ ${identity.name}`} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)} onPointerEnter={()=>{if(!bot)void loadGameProfile(identity.id!).catch(()=>{})}}>
   <span className="bpi-avatar"><img src={identity.image||'/avatar.png'} alt=""/><img className="bpi-avatar-frame" src="/images/lobby-play/profile-avatar-frame.png" alt=""/></span>
   <span className="bpi-copy"><small>{player?'เรา':'คู่แข่ง'}</small><strong title={identity.name}>{identity.name}</strong><span><Shield size={11}/>{bot?'BOT':rank?.rankName||'ผู้เล่น'}</span></span>
   <img className="bpi-name-frame" src="/images/lobby-play/profile-name-frame.png" alt=""/>
  </button>
  {open&&createPortal(<dialog ref={dialog} className="battle-player-mini" aria-label={`โปรไฟล์ ${identity.name}`} onCancel={event=>{event.preventDefault();setOpen(false)}} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)setOpen(false)}}}>
   <header><span><Shield size={16}/>โปรไฟล์ผู้เล่น</span><button autoFocus aria-label="ปิดโปรไฟล์" onClick={()=>setOpen(false)}><X size={19}/></button></header>
   <div className="bpp-identity"><span className="bpp-avatar"><img src={image} alt=""/><img src="/images/lobby-play/profile-avatar-frame.png" alt=""/></span><div><h2>{name}</h2><p><Shield size={15}/>{rankName||'กำลังโหลดแรงค์…'}</p></div></div>
   {bot?<p className="bpp-bot">คู่ฝึกซ้อม AI · ไม่จัดอันดับผู้เล่น</p>:<div className="bpp-stats"><div><small>ชนะ</small><strong>{wins?.toLocaleString()??'—'}</strong></div><div><small>แพ้</small><strong>{losses?.toLocaleString()??'—'}</strong></div><div><small>อัตราชนะ</small><strong>{rate===null?'—':rate+'%'}</strong></div></div>}
   {!bot&&details?.rank.nextWins!=null&&<p className="bpp-progress">อีก {Math.max(0,details.rank.nextWins-(wins||0)).toLocaleString()} ชัยชนะ สู่ {details.rank.nextName}</p>}
   {error&&<p className="bpp-error" role="alert">{error} <button onClick={()=>setRetry(value=>value+1)}>ลองใหม่</button></p>}
   {!bot&&identity.id!==currentUserId&&<FriendAction key={identity.id} id={identity.id!}/>}
  </dialog>,document.body)}
 </>;
}
