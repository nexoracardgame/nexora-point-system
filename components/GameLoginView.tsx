"use client";

import {useEffect,useRef,useState} from 'react';
import {Download,Settings,X,Volume2,VolumeX} from 'lucide-react';
import {playGameUiSound} from '@/lib/game-ui-audio';
import '@/app/login/GameLogin.css';

type Props={busy:boolean;checking:boolean;error:string;onLogin:(provider:'line'|'google')=>void};
const providers=[['google','Google'],['line','LINE'],['facebook','Facebook'],['discord','Discord'],['apple','Apple']] as const;
const sections=[['news','NEWS','ข่าวสาร'],['event','EVENT','กิจกรรม'],['guide','GUIDE','วิธีเล่น'],['support','SUPPORT','ติดต่อเรา']] as const;
export default function GameLoginView({busy,checking,error,onLogin}:Props){
 const [panel,setPanel]=useState(''),[flash,setFlash]=useState(''),[notice,setNotice]=useState(''),[muted,setMuted]=useState(false);
 const dialog=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  if(!panel)return;
  const previous=document.activeElement as HTMLElement|null;
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){setPanel('');return}if(event.key==='Tab'){const buttons=[...dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')||[]];const first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}};
  document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus()};
 },[panel]);
 const cue=(name:string)=>{playGameUiSound();setFlash(name);};
 const open=(name:string)=>{cue(name);if(name==='settings')try{setMuted(localStorage.getItem('triad-battle-muted')==='1')}catch{}setPanel(name)};
 const login=(provider:'line'|'google')=>{cue(provider);onLogin(provider)};
 return <main className="nexora-game-login" aria-busy={busy}>
  <img className="nexora-game-login-scene" src="/images/triad/nexora-command-original.webp" alt="" fetchPriority="high" loading="eager"/>
  <nav className="nexora-login-rail" aria-label="ข้อมูลเกม">{sections.map(([id,label,thai])=><button type="button" key={id} title={thai} aria-label={thai} onClick={()=>open(id)}><img src={`/images/game-login/${id}.webp`} alt={label}/></button>)}</nav>
  <div className="nexora-login-utilities"><button type="button" title="ตั้งค่าเสียง" aria-label="ตั้งค่าเสียง" onClick={()=>open('settings')}><Settings size={21}/></button><button type="button" title="ติดต่อเรา" aria-label="ติดต่อฝ่ายสนับสนุน" onClick={()=>open('support')}><img src="/images/game-login/support.webp" alt=""/></button></div>
  <section className="nexora-game-login-content">
   <img className="nexora-game-login-logo" src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME" fetchPriority="high"/>
   <div className="nexora-login-rule"><span>CARD GAME ONLINE</span></div>
   <div className="nexora-game-login-actions">
    <button type="button" className="nexora-login-art" aria-label="เข้าสู่ระบบ" data-flash={flash==='login'} disabled={busy} onAnimationEnd={()=>setFlash('')} onClick={()=>open('login')}><img src="/images/game-login/login.webp" alt="LOGIN"/></button>
    <button type="button" className="nexora-login-art" aria-label="สมัครสมาชิก" data-flash={flash==='register'} disabled={busy} onAnimationEnd={()=>setFlash('')} onClick={()=>open('register')}><img src="/images/game-login/register.webp" alt="สมัครสมาชิก"/></button>
    <div className="nexora-login-divider">เข้าสู่ระบบด้วย</div>
    <div className="nexora-login-social">{providers.map(([id,label])=><button type="button" data-provider={id} key={id} title={id==='line'||id==='google'?`เข้าสู่ระบบด้วย ${label}`:`${label} · ยังไม่เปิดให้บริการ`} aria-label={`เข้าสู่ระบบด้วย ${label}`} disabled={busy} data-flash={flash===id} onAnimationEnd={()=>setFlash('')} onClick={()=>{if(id==='line'||id==='google')login(id);else{cue(id);setNotice(`${label} ยังไม่เปิดให้บริการ กรุณาใช้ LINE หรือ Google`)}}}><img src={`/images/game-login/${id}.webp`} alt=""/><span>{label}</span></button>)}</div>
   </div>
   <a className="nexora-game-download" href="/downloads/game-windows/NEXORA-CARD-GAME-Setup-1.0.2.exe" download><Download size={16}/>ดาวน์โหลด Windows PC<span>64-bit · v1.0.2</span></a>
   <div className="nexora-login-feedback" aria-live="polite">{error?<p role="alert">{error}</p>:<p role="status">{busy?(checking?'กำลังตรวจสอบบัญชี':'กำลังเข้าสู่สนาม'):notice}</p>}</div>
  </section>
  {panel&&<div className="nexora-login-dialog-backdrop" onClick={()=>setPanel('')}><section ref={dialog} className="nexora-login-dialog" role="dialog" aria-modal="true" aria-label={panel==='login'?'เข้าสู่ระบบ':panel==='register'?'สมัครสมาชิก':panel==='settings'?'ตั้งค่า':sections.find(item=>item[0]===panel)?.[2]} onClick={event=>event.stopPropagation()}><button type="button" className="nexora-login-dialog-close" title="ปิด" aria-label="ปิด" autoFocus onClick={()=>{playGameUiSound('back');setPanel('')}}><X size={20}/></button><h2>{panel==='login'?'เข้าสู่ระบบ':panel==='register'?'สมัครสมาชิก':panel==='settings'?'ตั้งค่า':sections.find(item=>item[0]===panel)?.[2]}</h2>{panel==='login'||panel==='register'?<><p>{panel==='register'?'เริ่มต้นใช้งานด้วยบัญชี LINE หรือ Google':'เลือกบัญชีของคุณ'}</p><div className="nexora-login-provider-choices">{(['line','google'] as const).map(id=><button type="button" key={id} disabled={busy} onClick={()=>login(id)}><img src={`/images/game-login/${id}.webp`} alt=""/>{id==='line'?'LINE':'Google'}</button>)}</div></>:panel==='settings'?<button type="button" className="nexora-login-sound" aria-pressed={muted} onClick={()=>{const next=localStorage.getItem('triad-battle-muted')!=='1';localStorage.setItem('triad-battle-muted',next?'1':'0');setMuted(next);window.dispatchEvent(new Event('nexora:audio-preference'))}}>{muted?<VolumeX/>:<Volume2/>}{muted?'เปิดเสียง':'ปิดเสียง'}</button>:<p>{panel==='news'?'ยังไม่มีประกาศใหม่':panel==='event'?'ยังไม่มีกิจกรรมที่เปิดให้เข้าร่วม':panel==='guide'?'เข้าสู่ระบบ เลือก TRIAD 3 ใบ หรือ PENTAD 5 ใบ แล้วสร้างห้องหรือเข้าร่วมสนามประลอง': 'ช่องทางติดต่อเพิ่มเติมยังไม่เปิดให้บริการ'}</p>}</section></div>}
 </main>;
}
