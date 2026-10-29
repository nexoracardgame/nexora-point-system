"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useSession} from 'next-auth/react';
import {useRouter} from 'next/navigation';
import {Check,Search,UserPlus,Users,X} from 'lucide-react';
import {getBrowserSupabaseClient} from '@/lib/supabase-browser';
import {loadGameFriends,gameFriendId,type GameFriend} from '@/lib/game-friends-client';
import type {GameInvitation,InvitationMode} from '@/lib/game-invitation-store';
import './GameInvitations.css';
type Room={mode:InvitationMode;code:string};
const modeName={triad:'TRIAD · 3 ใบ',pentad:'PENTAD · 5 ใบ',heptad:'HEPTAD · 7 ใบ'};
export default function GameInvitations(){
 const {data:session}=useSession(),router=useRouter(),owner=session?.user?.id;
 const [context,setContext]=useState<Room|null>(null),[friends,setFriends]=useState<GameFriend[]>([]),[sent,setSent]=useState<string[]>([]),[incoming,setIncoming]=useState<GameInvitation[]>([]);
 const [query,setQuery]=useState(''),[error,setError]=useState(''),[toastError,setToastError]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState<string[]>([]);
 const pending=useRef(new Set<string>()),resolved=useRef(new Set<string>()),dialog=useRef<HTMLElement>(null),currentContext=useRef(context);currentContext.current=context;
 const post=async(body:Record<string,unknown>)=>{const r=await fetch('/api/game-invitations',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(12000),body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'ดำเนินการไม่สำเร็จ');return data;};
 useEffect(()=>{
  if(!owner)return;let stopped=false,running=false;
  const refresh=async()=>{if(running||document.hidden)return;running=true;try{const r=await fetch('/api/game-invitations',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(r.ok){const data=await r.json();if(!stopped)setIncoming((data.invitations||[]).filter((item:GameInvitation)=>!resolved.current.has(item.id)));}}catch{}finally{running=false}};
  void refresh();const timer=setInterval(()=>void refresh(),5000),client=getBrowserSupabaseClient();
  const channel=client?.channel(`game-invitations:${owner}`).on('broadcast',{event:'changed'},()=>void refresh()).subscribe();
  const open=(event:Event)=>{const room=(event as CustomEvent<Room>).detail;if(room&&['triad','pentad','heptad'].includes(room.mode)&&/^\d{6}$/.test(room.code)){setContext(room);setQuery('');setError('');setSent([]);}};
  window.addEventListener('nexora:invite-friends',open);window.addEventListener('focus',refresh);
  return()=>{stopped=true;clearInterval(timer);window.removeEventListener('nexora:invite-friends',open);window.removeEventListener('focus',refresh);if(client&&channel)void client.removeChannel(channel)};
 },[owner]);
 useEffect(()=>{
  if(!context||!owner)return;let stopped=false;setLoading(true);
  const previous=document.activeElement;dialog.current?.focus();
  void Promise.all([loadGameFriends(owner,true),fetch(`/api/game-invitations?mode=${context.mode}&code=${context.code}`,{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('โหลดคำเชิญไม่สำเร็จ');return r.json();})]).then(([data,status])=>{if(!stopped){setFriends(data.friends);setSent(status.invitations.map((i:GameInvitation)=>i.toId));}}).catch(e=>{if(!stopped)setError(e.message);}).finally(()=>{if(!stopped)setLoading(false);});
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setContext(null);}if(e.key==='Tab'){const controls=[...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input')||[])];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',key,true);return()=>{stopped=true;document.removeEventListener('keydown',key,true);if(previous instanceof HTMLElement)previous.focus();};
 },[context,owner]);
 const invite=async(friend:GameFriend)=>{if(!context)return;const id=gameFriendId(friend);if(pending.current.has(id)||sent.includes(id))return;pending.current.add(id);setBusy([...pending.current]);setError('');try{await post({action:'invite',...context,toId:id});if(currentContext.current===context)setSent(items=>[...new Set([...items,id])]);}catch(e){if(currentContext.current===context)setError(e instanceof Error?e.message:'ส่งคำเชิญไม่สำเร็จ');}finally{pending.current.delete(id);setBusy([...pending.current]);}};
 const respond=async(invitation:GameInvitation,accept:boolean)=>{
  if(pending.current.has(invitation.id))return;pending.current.add(invitation.id);setBusy([...pending.current]);setToastError('');
  try{const data=await post({action:accept?'accept':'decline',id:invitation.id});resolved.current.add(invitation.id);setIncoming(items=>items.filter(i=>i.id!==invitation.id));
   if(accept&&data.room){
    if(data.room.mode==='triad'){
     const r=await fetch(`/api/triad-rooms?room=${data.room.code}&ranks=0`,{cache:'no-store'});const payload=await r.json(),snapshot={room:payload.rooms?.[0]};
     if(!r.ok||!snapshot.room)throw Error('เข้าห้องแล้ว กรุณากลับหน้าหลักเกม');
     try{const cached=JSON.stringify({participantId:owner,room:snapshot.room});sessionStorage.setItem('nexora:triad:active-room',cached);localStorage.setItem('nexora:triad:active-room',cached);}catch{}
     window.dispatchEvent(new CustomEvent('nexora:invitation-joined',{detail:snapshot.room}));router.push('/game');
    }else router.push(`/game/${data.room.mode}?room=${data.room.code}`);
   }
  }catch(e){setToastError(e instanceof Error?e.message:'ตอบรับไม่สำเร็จ');}finally{pending.current.delete(invitation.id);setBusy([...pending.current]);}
 };
 if(!owner||typeof document==='undefined')return null;
 return createPortal(<>
  {context&&<div className="game-invite-overlay" role="dialog" aria-modal="true" aria-labelledby="game-invite-title"><section className="game-invite-window" ref={dialog} tabIndex={-1}>
   <img className="game-invite-world" src="/images/versus/arena.png" alt=""/><header><div><Users/><h2 id="game-invite-title">เชิญเพื่อน</h2><small>{modeName[context.mode]} · ห้อง {context.code}</small></div><button onClick={()=>setContext(null)} title="ปิด" aria-label="ปิดหน้าต่างเชิญเพื่อน"><X/></button></header>
   <label className="game-invite-search"><Search size={18}/><input aria-label="ค้นหาเพื่อน" placeholder="ค้นหาเพื่อน" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   {error&&<p role="alert">{error}</p>}<div className="game-invite-list">{loading?<p>กำลังโหลดรายชื่อเพื่อน</p>:friends.filter(f=>`${f.displayName} ${f.username||''}`.toLowerCase().includes(query.toLowerCase())).map(friend=>{const id=gameFriendId(friend),done=sent.includes(id);return <article key={id}><img src={friend.image||'/avatar.png'} alt=""/><div><strong>{friend.displayName}</strong><small>{friend.username||'NEXORA DUELIST'}</small></div><button disabled={done||busy.includes(id)} onClick={()=>void invite(friend)}>{done?<Check size={16}/>:<UserPlus size={16}/>} {done?'เชิญแล้ว':busy.includes(id)?'กำลังส่ง':'เชิญ'}</button></article>})}{!loading&&!friends.length&&<p>ยังไม่มีเพื่อนในรายชื่อ</p>}</div>
  </section></div>}
  <aside className="game-invite-toasts" aria-live="polite">{toastError&&<p role="alert">{toastError}<button onClick={()=>setToastError('')} aria-label="ปิดข้อความ"><X size={16}/></button></p>}{incoming.slice(0,3).map(item=><section key={item.id} className="game-invite-toast"><img className="game-invite-world" src="/images/versus/arena.png" alt=""/><div className="game-invite-sender"><img src={item.senderImage||'/avatar.png'} alt=""/><div><strong>{item.senderName}</strong><span>เชิญคุณเข้าร่วมการประลอง</span></div></div><p>{modeName[item.mode]} · ห้อง {item.code}</p><footer><button disabled={busy.includes(item.id)} onClick={()=>void respond(item,false)}>ปฏิเสธ</button><button disabled={busy.includes(item.id)} onClick={()=>void respond(item,true)}><Check size={16}/>ยอมรับ</button></footer></section>)}</aside>
 </>,document.body);
}
