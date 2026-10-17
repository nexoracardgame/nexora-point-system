"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { Check, ChevronRight, Clock3, LoaderCircle, MessageSquare, RefreshCw, Search, Shield, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { useOnlinePresence } from './OnlinePresenceProvider';
import './GameFriendsPanel.css';
import {warmGameProfile} from '@/lib/game-profile-client';
import {cachedGameFriends,loadGameFriends,gameFriendId,type GameFriend as Player} from '@/lib/game-friends-client';
import {openGameProfile} from '@/lib/game-profile-navigation';

type Mode = 'friends'|'requests'|'discover';

export default function GameFriendsPanel({onClose}:{onClose:()=>void}) {
  const {data:session,status}=useSession();
  const {isOnline}=useOnlinePresence();
  const [mode,setMode]=useState<Mode>('friends');
  const owner=session?.user?.id||'',cached=cachedGameFriends(owner);
  const [friends,setFriends]=useState<Player[]>(cached?.friends||[]),[requests,setRequests]=useState<Player[]>(cached?.requests||[]),[results,setResults]=useState<Player[]>([]);
  const [query,setQuery]=useState(''),[loading,setLoading]=useState(!cached),[searching,setSearching]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(''),[removing,setRemoving]=useState('');
  const dialog=useRef<HTMLDivElement>(null),searchRef=useRef<HTMLInputElement>(null);
  const mounted=useRef(true),searchVersion=useRef(0),actionPending=useRef(false),loadVersion=useRef(0);
  const idOf=gameFriendId;
  useEffect(()=>{let stopped=false;const players=mode==='discover'?results:mode==='requests'?requests:friends;let cursor=0;const worker=async()=>{while(!stopped&&cursor<Math.min(players.length,12)){const player=players[cursor++];await warmGameProfile(idOf(player))}};void worker();void worker();return()=>{stopped=true}},[friends,requests,results,mode]);
  const load=useCallback(async(signal?:AbortSignal,force=signal===undefined)=>{
    const version=++loadVersion.current;
    try {
      const data=await loadGameFriends(owner,force);
      if(mounted.current&&!signal?.aborted&&version===loadVersion.current){setFriends(data.friends||[]);setRequests(data.requests||[]);setError('');}
    } catch(e) {if(mounted.current&&!signal?.aborted&&version===loadVersion.current)setError(e instanceof Error?e.message:'เชื่อมต่อไม่สำเร็จ');}
    finally {if(mounted.current&&!signal?.aborted&&version===loadVersion.current)setLoading(false);}
  },[owner]);
  useEffect(()=>{
    mounted.current=true;
    const previous=document.activeElement as HTMLElement|null;
    dialog.current?.focus();
    const keyboard=(e:KeyboardEvent)=>{
      if(document.querySelector('.nexora-profile-overlay'))return;
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(!actionPending.current)onClose();}
      if(e.key==='Tab'){
        const elements=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,a[href],[tabindex="0"]')||[]).filter(el=>el.getClientRects().length);
        const first=elements[0],last=elements.at(-1);
        if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialog.current)){e.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',keyboard,true);
    return ()=>{mounted.current=false;document.removeEventListener('keydown',keyboard,true);previous?.focus();};
  },[onClose]);
  useEffect(()=>{
    if(status!=='authenticated')return;
    const controller=new AbortController();
    const initial=setTimeout(()=>void load(controller.signal),0);
    const timer=setInterval(()=>{if(!document.hidden&&!actionPending.current)void load(controller.signal);},15000);
    return ()=>{controller.abort();clearTimeout(initial);clearInterval(timer);};
  },[load,status]);
  useEffect(()=>{
    if(mode!=='discover'||status!=='authenticated')return;
    const controller=new AbortController(),version=++searchVersion.current;
    const timer=setTimeout(async()=>{
      setSearching(true);
      try {
        const response=await fetch('/api/community/search?q='+encodeURIComponent(query),{cache:'no-store',signal:controller.signal});
        const data=await response.json();
        if(!response.ok)throw Error('ค้นหาผู้เล่นไม่สำเร็จ');
        if(version===searchVersion.current&&!controller.signal.aborted){setResults(data.users||[]);setError('');}
      }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'ค้นหาไม่สำเร็จ');}
      finally{if(!controller.signal.aborted)setSearching(false);}
    },300);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[query,mode,status]);
  async function action(player:Player,operation:'request'|'accept'|'reject'|'remove') {
    if(actionPending.current)return;
    actionPending.current=true;setBusy(idOf(player));setError('');setNotice('');
    try {
      const payload=operation==='accept'||operation==='reject'?{action:'respond',requestId:player.requestId||player.id,decision:operation}:{action:operation,targetUserId:idOf(player)};
      const response=await fetch('/api/community/friends',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await response.json();if(!response.ok)throw Error(data.error||'ดำเนินการไม่สำเร็จ');
      if(!mounted.current)return;
      setResults(items=>items.map(item=>idOf(item)===idOf(player)?{...item,relation:operation==='request'?(data.relation?.status||'outgoing'):operation==='accept'?'friends':'none',requestId:data.relation?.requestId||null}:item));
      setRemoving('');setNotice(operation==='request'?'ส่งคำขอแล้ว':operation==='accept'?'รับเป็นเพื่อนแล้ว':operation==='remove'?'ลบเพื่อนแล้ว':'ปฏิเสธคำขอแล้ว');
      await load(undefined,true);
      window.dispatchEvent(new Event('focus'));
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'ดำเนินการไม่สำเร็จ');}
    finally{actionPending.current=false;if(mounted.current)setBusy('');}
  }
  function chat(player:Player){window.dispatchEvent(new CustomEvent('nexora:open-floating-chat',{detail:{kind:'direct',userId:idOf(player),userName:player.displayName,userImage:player.image}}));onClose();}
  function selectMode(next:Mode){setMode(next);setQuery('');setRemoving('');setNotice('');setSearching(next==='discover');}
  function changeQuery(value:string){setQuery(value);if(mode==='discover')setSearching(true);}
  const online=friends.filter(p=>isOnline(idOf(p))).length;
  const needle=query.trim().toLowerCase();
  const items=mode==='discover'?results:(mode==='requests'?requests:friends).filter(p=>[p.displayName,p.username,idOf(p)].some(v=>String(v||'').toLowerCase().includes(needle)));
  const sorted=mode==='friends'?[...items].sort((a,b)=>Number(isOnline(idOf(b)))-Number(isOnline(idOf(a)))):items;
  return createPortal(<div className="game-friends-overlay">
    <div className="gf-shell" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="gf-title" tabIndex={-1}>
      <img className="gf-world" src="/images/versus/arena.png" alt=""/>
      <header className="gf-header"><div className="gf-heading"><Users size={24}/><div><span>SOCIAL / NEXORA</span><h1 id="gf-title">เพื่อนร่วมสมรภูมิ</h1></div></div><button className="gf-icon" title="ปิด" aria-label="ปิดหน้าเพื่อน" onClick={onClose}><X/></button></header>
      <div className="gf-layout"><aside className="gf-sidebar">
        <div className="gf-self"><img src={session?.user?.image||'/avatar.png'} alt=""/><div><strong>{session?.user?.name||'PLAYER'}</strong><span><i/>พร้อมเชื่อมต่อ</span></div><Shield size={18}/></div>
        <nav aria-label="หมวดหมู่เพื่อน">{([{key:'friends',icon:Users,label:'เพื่อนทั้งหมด',count:friends.length},{key:'requests',icon:UserPlus,label:'คำขอเป็นเพื่อน',count:requests.length},{key:'discover',icon:Search,label:'ค้นหาผู้เล่น',count:null}] as const).map(({key,icon:Icon,label,count})=><button key={key} aria-current={mode===key?'page':undefined} onClick={()=>selectMode(key)}><Icon size={19}/><span>{label}</span>{count!==null&&<b>{count}</b>}<ChevronRight size={15}/></button>)}</nav>
        <div className="gf-presence"><span><i/>{online} ออนไลน์</span><span>{friends.length} เพื่อน</span></div>
        <img className="gf-brand" src="/images/triad/nexora-official-logo.webp" alt="NEXORA"/>
      </aside><section className="gf-main" aria-label="รายชื่อผู้เล่น">
        <div className="gf-toolbar"><label className="gf-search"><Search size={19}/><input ref={searchRef} value={query} onChange={e=>changeQuery(e.target.value)} placeholder="ค้นหาชื่อหรือไอดีผู้เล่น" aria-label="ค้นหาชื่อหรือไอดีผู้เล่น"/>{query&&<button title="ล้างคำค้น" aria-label="ล้างคำค้น" onClick={()=>{changeQuery('');searchRef.current?.focus();}}><X size={16}/></button>}</label><button className="gf-icon" aria-label="โหลดรายชื่อใหม่" title="โหลดรายชื่อใหม่" onClick={()=>void load()}><RefreshCw size={18}/></button></div>
        <div className="gf-list-heading"><h2>{mode==='friends'?'รายชื่อเพื่อน':mode==='requests'?'คำขอที่ได้รับ':'ผู้เล่นทั้งหมด'}</h2><span>{sorted.length} ผู้เล่น</span></div>
        {error&&<div className="gf-error" role="alert">{error}</div>}{notice&&<div className="gf-notice" role="status">{notice}</div>}
        <div className="gf-list" aria-busy={loading||searching}>
          {status==='unauthenticated'?<div className="gf-empty"><Shield size={44}/><h3>เข้าสู่ระบบเพื่อดูเพื่อน</h3></div>:(loading||searching)?<div className="gf-empty" role="status"><LoaderCircle className="gf-spin" size={30}/><span>กำลังเชื่อมต่อ...</span></div>:!sorted.length?<div className="gf-empty"><Users size={46}/><h3>{query?'ไม่พบผู้เล่น':mode==='requests'?'ไม่มีคำขอใหม่':mode==='discover'?'ยังไม่พบผู้เล่น':'ยังไม่มีเพื่อน'}</h3>{mode==='friends'&&!query&&<button className="gf-command" onClick={()=>selectMode('discover')}><UserPlus size={17}/>ค้นหาผู้เล่น</button>}</div>:sorted.map(p=>{
            const id=idOf(p),isBusy=busy===id,relation=mode==='requests'?'incoming':mode==='friends'?'friends':p.relation||'none';
            return <article className="gf-player" key={id}><button type="button" className="gf-avatar" aria-label={'เปิดโปรไฟล์ '+p.displayName} onClick={()=>openGameProfile(id)} onPointerEnter={()=>void warmGameProfile(id)} onFocus={()=>void warmGameProfile(id)}><img src={p.image||'/avatar.png'} alt="" onError={e=>{if(!e.currentTarget.src.endsWith('/avatar.png'))e.currentTarget.src='/avatar.png';}}/><i data-online={isOnline(id)}/></button><div className="gf-player-info"><h3 title={p.displayName}><button type="button" className="gf-name" onClick={()=>openGameProfile(id)} onPointerEnter={()=>void warmGameProfile(id)} onFocus={()=>void warmGameProfile(id)}>{p.displayName}</button></h3><span>{isOnline(id)?'ออนไลน์':'ออฟไลน์'}{p.username?' · @'+p.username:''}</span><small title={id}>ID: {id}</small></div><div className="gf-actions">
              {isBusy?<LoaderCircle size={20} className="gf-spin"/>:relation==='friends'?<><button className="gf-command" title="ส่งข้อความ" onClick={()=>chat(p)}><MessageSquare size={17}/><span>แชท</span></button><button className="gf-icon gf-danger" title="ลบเพื่อน" aria-label={'ลบเพื่อน '+p.displayName} onClick={()=>setRemoving(removing===id?'':id)}><UserMinus size={17}/></button></>:relation==='incoming'?<><button className="gf-command" title="รับเป็นเพื่อน" onClick={()=>void action(p,'accept')}><Check size={17}/><span>ยอมรับ</span></button><button className="gf-icon" title="ปฏิเสธ" aria-label="ปฏิเสธคำขอ" onClick={()=>void action(p,'reject')}><X size={17}/></button></>:relation==='outgoing'?<span className="gf-pending"><Clock3 size={16}/>รอตอบรับ</span>:relation==='self'?<span>คุณ</span>:<button className="gf-command" title="เพิ่มเพื่อน" onClick={()=>void action(p,'request')}><UserPlus size={17}/><span>เพิ่มเพื่อน</span></button>}
              </div>{removing===id&&<div className="gf-remove"><span>ลบ {p.displayName} ออกจากเพื่อน?</span><button onClick={()=>void action(p,'remove')}>ยืนยัน</button><button onClick={()=>setRemoving('')}>ยกเลิก</button></div>}</article>;
          })}
        </div><footer className="gf-footer"><Shield size={14}/><span>NEXORA SOCIAL</span><span>{friends.length} CONNECTIONS</span></footer>
      </section></div>
    </div>
  </div>,document.body);
}
