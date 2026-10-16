"use client";

import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Download,Settings,X,Volume2,VolumeX,UserRound,LockKeyhole,Eye,EyeOff} from 'lucide-react';
import {playGameUiSound} from '@/lib/game-ui-audio';
import {loadLoginWallpaper} from '@/lib/login-wallpaper';
import '@/app/login/GameLogin.css';

type Props={busy:boolean;checking:boolean;error:string;onLogin:(provider:'line'|'google')=>void;onCredentials:(username:string,password:string,confirmation?:string)=>Promise<void>};
const providers=[['google','Google'],['line','LINE'],['facebook','Facebook'],['discord','Discord']] as const;
const sections=[['news','NEWS','ข่าวสาร'],['event','EVENT','กิจกรรม'],['guide','GUIDE','วิธีเล่น'],['support','SUPPORT','ติดต่อเรา']] as const;

export default function GameLoginView({busy,checking,error,onLogin,onCredentials}:Props){
 const [panel,setPanel]=useState(''),[flash,setFlash]=useState(''),[notice,setNotice]=useState(''),[muted,setMuted]=useState(false);
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[remember,setRemember]=useState(false),[showPassword,setShowPassword]=useState(false),[videoUrl,setVideoUrl]=useState('');
 const [browserDownload,setBrowserDownload]=useState(false);
 const [videoReady,setVideoReady]=useState(false),[videoFailed,setVideoFailed]=useState(false);
 const [utilitySlot,setUtilitySlot]=useState<Element|null>(null);
 useEffect(()=>{const locate=()=>setUtilitySlot(document.querySelector('[data-game-utilities-slot]'));locate();const observer=new MutationObserver(locate);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect()},[]);
 const dialog=useRef<HTMLElement|null>(null),video=useRef<HTMLVideoElement|null>(null);
 useEffect(()=>{
  const bridge=(window as typeof window&{nexoraDesktop?:{isDesktop?:boolean;isGameDesktop?:boolean}}).nexoraDesktop;
  const installed=Boolean(bridge?.isDesktop||bridge?.isGameDesktop||navigator.userAgent.includes('Electron/'));
  setBrowserDownload(!installed);document.documentElement.dataset.gameDesktop=String(installed);
  let active=true,objectUrl='';const controller=new AbortController();try{const name=localStorage.getItem('nexora-game-username');if(name){setUsername(name);setRemember(true)}}catch{}
  void loadLoginWallpaper(controller.signal).then(url=>{if(active){objectUrl=url;setVideoUrl(url)}else URL.revokeObjectURL(url)}).catch(()=>{if(active&&!controller.signal.aborted)setVideoFailed(true)});
  return()=>{active=false;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl)};
 },[]);
 useEffect(()=>{const sync=()=>{if(!video.current)return;let paused=false;try{paused=localStorage.getItem('triad-command-motion-off')==='1'}catch{}if(document.hidden||paused)video.current.pause();else void video.current.play().catch(()=>{})};sync();document.addEventListener('visibilitychange',sync);window.addEventListener('nexora:motion-preference',sync);return()=>{document.removeEventListener('visibilitychange',sync);window.removeEventListener('nexora:motion-preference',sync)}},[videoUrl]);
 useEffect(()=>{
  if(!panel)return;
  const previous=document.activeElement as HTMLElement|null;
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&!busy){setPanel('');setConfirmation('');return}
   if(event.key==='Tab'){const controls=[...dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]')||[]],first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
  };
  document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus()};
 },[panel,busy]);
 const cue=(name:string)=>{playGameUiSound();setFlash(name)};
 const open=(name:string)=>{cue(name);if(name==='settings')try{setMuted(localStorage.getItem('triad-battle-muted')==='1')}catch{}setPanel(name)};
 const submit=async(register=false)=>{
  cue('login');try{if(remember)localStorage.setItem('nexora-game-username',username);else localStorage.removeItem('nexora-game-username')}catch{}
  await onCredentials(username,password,register?confirmation:undefined);setPassword('');setConfirmation('');
 };
 const social=<div className="nexora-login-social">{providers.map(([id,label])=><button type="button" data-provider={id} key={id} title={id==='line'||id==='google'?`เข้าสู่ระบบด้วย ${label}`:`${label} · ยังไม่เปิดให้บริการ`} aria-label={`เข้าสู่ระบบด้วย ${label}`} disabled={busy} data-flash={flash===id} onAnimationEnd={()=>setFlash('')} onClick={()=>{cue(id);if(id==='line'||id==='google')onLogin(id);else setNotice(`${label} ยังไม่เปิดให้บริการ กรุณาใช้ LINE หรือ Google`)}}><img src={`/images/game-login/plain-${id}.webp`} alt=""/><span>{label}</span></button>)}</div>;
 const utilities=<div className="nexora-login-utilities"><button type="button" title="ตั้งค่าเสียง" aria-label="ตั้งค่าเสียง" onClick={()=>open('settings')}><Settings size={21}/></button></div>;
 return <main className="nexora-game-login" aria-busy={busy}>
  {videoFailed&&<img className="nexora-game-login-scene" src="/images/triad/nexora-command-original.webp" alt=""/>}
  {videoUrl&&!videoFailed&&<video ref={video} className="nexora-game-login-video" src={videoUrl} autoPlay loop muted playsInline aria-hidden="true" onLoadedData={()=>{const element=video.current;if(element?.requestVideoFrameCallback)element.requestVideoFrameCallback(()=>setVideoReady(true));else setVideoReady(true)}} onError={()=>setVideoFailed(true)} style={{opacity:videoReady?1:0,transition:'opacity 500ms ease'}}/>}
  <nav className="nexora-login-rail" aria-label="ข้อมูลเกม">{sections.map(([id,label,thai])=><button type="button" key={id} title={thai} aria-label={thai} onClick={()=>open(id)}><img src={`/images/game-login/${id}.webp`} alt={label}/></button>)}</nav>
  {utilitySlot?createPortal(utilities,utilitySlot):utilities}
  <section className="nexora-game-login-content">
   <img className="nexora-game-login-logo" src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME" fetchPriority="high"/>
   <div className="nexora-game-login-actions">
    <form className="nexora-credential-frame" onSubmit={event=>{event.preventDefault();void submit()}}>
     <img className="nexora-credential-frame-art" src="/images/game-login/form-v2.webp" alt=""/>
     <label className="nexora-credential-field" data-field="username"><UserRound aria-hidden="true"/><input aria-label="Username" name="username" placeholder="Username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={24} pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{2,23}" value={username} onChange={event=>setUsername(event.target.value)} disabled={busy}/></label>
     <label className="nexora-credential-field" data-field="password"><LockKeyhole aria-hidden="true"/><input aria-label="Password" name="password" placeholder="Password" autoComplete="current-password" type={showPassword?'text':'password'} required minLength={12} maxLength={128} value={password} onChange={event=>setPassword(event.target.value)} disabled={busy}/><button type="button" className="nexora-password-eye" aria-label={showPassword?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน'} title={showPassword?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน'} onClick={()=>setShowPassword(value=>!value)}>{showPassword?<EyeOff/>:<Eye/>}</button></label>
     <label className="nexora-credential-remember"><input type="checkbox" checked={remember} onChange={event=>setRemember(event.target.checked)}/><span>จำชื่อผู้ใช้</span></label>
     <button type="button" className="nexora-credential-forgot" onClick={()=>open('forgot')}>ลืมรหัสผ่าน?</button>
     <button type="submit" className="nexora-credential-submit" aria-label="เข้าสู่ระบบ" disabled={busy} data-flash={flash==='login'} onAnimationEnd={()=>setFlash('')}>LOGIN</button>
     <div className="nexora-credential-social"><div className="nexora-login-divider">หรือเข้าสู่ระบบด้วย</div>{social}</div>
    </form>
    <button type="button" className="nexora-register-link" disabled={busy} onClick={()=>open('register')}>สมัครสมาชิกใหม่</button>
   </div>
   {browserDownload&&<a className="nexora-game-download" href="/downloads/game-windows/NEXORA-CARD-GAME-Setup-1.0.3.exe" download><Download size={16}/>ดาวน์โหลด Windows PC<span>64-bit · v1.0.3</span></a>}
   <div className="nexora-login-feedback" aria-live="polite">{error?<p role="alert">{error}</p>:<p role="status">{busy?(checking?'กำลังตรวจสอบบัญชี':'กำลังเข้าสู่สนาม'):notice}</p>}</div>
  </section>
  {panel&&<div className="nexora-login-dialog-backdrop" onClick={()=>{if(!busy)setPanel('')}}><section ref={dialog} className="nexora-login-dialog" role="dialog" aria-modal="true" aria-label={panel==='register'?'สมัครสมาชิก':panel==='forgot'?'ลืมรหัสผ่าน':panel==='settings'?'ตั้งค่า':sections.find(item=>item[0]===panel)?.[2]} onClick={event=>event.stopPropagation()}>
   <button type="button" className="nexora-login-dialog-close" title="ปิด" aria-label="ปิด" disabled={busy} autoFocus onClick={()=>{playGameUiSound('back');setPanel('');setConfirmation('')}}><X size={20}/></button>
   <h2>{panel==='register'?'สมัครสมาชิก':panel==='forgot'?'ลืมรหัสผ่าน':panel==='settings'?'ตั้งค่า':sections.find(item=>item[0]===panel)?.[2]}</h2>
   {panel==='register'?<form className="nexora-register-form" onSubmit={event=>{event.preventDefault();void submit(true)}}>
    <label>Username<input aria-label="Username สำหรับสมัคร" name="username" autoComplete="username" autoCapitalize="none" required minLength={3} maxLength={24} pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{2,23}" value={username} onChange={event=>setUsername(event.target.value)} disabled={busy}/></label>
    <small>3–24 ตัว: a–z, 0–9, _ หรือ -</small>
    <label>Password<input aria-label="Password สำหรับสมัคร" name="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={event=>setPassword(event.target.value)} disabled={busy}/></label>
    <small>รหัสผ่าน 12–128 ตัว</small>
    <label>ยืนยัน Password<input aria-label="ยืนยัน Password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={event=>setConfirmation(event.target.value)} disabled={busy}/></label>
    <button type="submit" disabled={busy}>สมัครสมาชิกและเข้าสู่ระบบ</button>{error&&<p role="alert">{error}</p>}
   </form>:panel==='settings'?<button type="button" className="nexora-login-sound" aria-pressed={muted} onClick={()=>{const next=localStorage.getItem('triad-battle-muted')!=='1';localStorage.setItem('triad-battle-muted',next?'1':'0');setMuted(next);window.dispatchEvent(new Event('nexora:audio-preference'))}}>{muted?<VolumeX/>:<Volume2/>}{muted?'เปิดเสียง':'ปิดเสียง'}</button>:<p>{panel==='forgot'?'ยังไม่มีระบบรีเซ็ตรหัสผ่านอัตโนมัติ บัญชีที่เข้าได้ด้วย LINE หรือ Google ยังใช้ช่องทางเดิมได้':panel==='news'?'ยังไม่มีประกาศใหม่':panel==='event'?'ยังไม่มีกิจกรรมที่เปิดให้เข้าร่วม':panel==='guide'?'เข้าสู่ระบบ เลือก TRIAD 3 ใบ หรือ PENTAD 5 ใบ แล้วสร้างห้องหรือเข้าร่วมสนามประลอง':'ช่องทางติดต่อเพิ่มเติมยังไม่เปิดให้บริการ'}</p>}
  </section></div>}
 </main>;
}
