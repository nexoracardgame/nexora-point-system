"use client";

import {useEffect,useRef,useState,type ReactNode,type MouseEvent} from 'react';
import {useSession,signOut} from 'next-auth/react';
import Link from 'next/link';
import {createPortal} from 'react-dom';
import {Download,Coins,UserRound,ArrowUpRight,ChevronDown,X,LogOut,ShieldCheck,Settings2} from 'lucide-react';
import {gameWorldSections} from '@/lib/game-world-sections';
import './GameWebsite.css';
import GameBattleTutorials from './GameBattleTutorials';
import {loadLoginWallpaper} from '@/lib/login-wallpaper';

export default function GameWebsite({children}:{children?:ReactNode}){
 const {data:session}=useSession();
 const [panel,setPanel]=useState<'account'|null>(null);
 const [activeNews,setActiveNews]=useState<number|null>(null);
 const [wallet,setWallet]=useState<{coin:number;nexPoint:number}|null>(null);
 const [walletError,setWalletError]=useState(false);
 const [failedAvatar,setFailedAvatar]=useState<string|null>(null);
 const avatar=session?.user?.image||'';
 const dialog=useRef<HTMLDialogElement>(null);
 const heroVideo=useRef<HTMLVideoElement>(null);
 const [heroUrl,setHeroUrl]=useState(''),[heroReady,setHeroReady]=useState(false);
 const hasPage=Boolean(children);
 const [worldOpen,setWorldOpen]=useState(false),[worldPosition,setWorldPosition]=useState({left:0,top:0});
 const worldButton=useRef<HTMLButtonElement>(null),worldMenu=useRef<HTMLElement>(null),worldTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const cancelWorldClose=()=>{if(worldTimer.current)clearTimeout(worldTimer.current)};
 const openWorld=()=>{cancelWorldClose();const rect=worldButton.current?.getBoundingClientRect();if(rect){setWorldPosition({left:Math.max(12,Math.min(rect.left,window.innerWidth-272)),top:rect.bottom+12});setWorldOpen(true)}};
 const closeWorldSoon=()=>{cancelWorldClose();worldTimer.current=setTimeout(()=>setWorldOpen(false),150)};
 useEffect(()=>()=>{if(worldTimer.current)clearTimeout(worldTimer.current)},[]);
 useEffect(()=>{if(!worldOpen)return;const outside=(event:PointerEvent)=>{if(!worldButton.current?.contains(event.target as Node)&&!worldMenu.current?.contains(event.target as Node))setWorldOpen(false)};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setWorldOpen(false);worldButton.current?.focus()}};const close=()=>setWorldOpen(false);document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);window.addEventListener('resize',close);window.addEventListener('scroll',close,true);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true)}},[worldOpen]);
 useEffect(()=>{
  if(hasPage)return;
  const controller=new AbortController();let active=true,url='';
  setHeroReady(false);
  void loadLoginWallpaper(controller.signal).then(value=>{if(!active){URL.revokeObjectURL(value);return}url=value;setHeroUrl(value)}).catch(()=>{});
  return()=>{active=false;controller.abort();if(url)URL.revokeObjectURL(url);setHeroUrl('')};
 },[hasPage]);
 useEffect(()=>{const sync=()=>{const video=heroVideo.current;if(!video)return;if(document.hidden)video.pause();else void video.play().catch(()=>{})};sync();document.addEventListener('visibilitychange',sync);return()=>document.removeEventListener('visibilitychange',sync)},[heroUrl]);
 const login='/game/login?callbackUrl=%2Fgame';
 useEffect(()=>{
  setWallet(null);setWalletError(false);
  if(!session?.user?.id)return;
  const controller=new AbortController();
  void fetch('/api/game-wallet',{cache:'no-store',signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error('wallet');
   const data=await response.json();
   if(!Number.isFinite(data.coin)||!Number.isFinite(data.nexPoint))throw new Error('wallet');
   setWallet(data);
  }).catch(()=>{if(!controller.signal.aborted)setWalletError(true)});
  return()=>controller.abort();
 },[session?.user?.id]);
 useEffect(()=>{if(panel)dialog.current?.showModal();else dialog.current?.close()},[panel]);
 useEffect(()=>{
  if(!window.location.hash){window.scrollTo({top:0,left:0,behavior:'instant'});return}
  if(children)return;
  const frame=requestAnimationFrame(()=>document.getElementById(window.location.hash.slice(1))?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
  return()=>cancelAnimationFrame(frame);
 },[children]);
 const scrollToSection=(id:string)=>(event:MouseEvent<HTMLAnchorElement>)=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const section=document.getElementById(id);if(!section)return;event.preventDefault();section.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});window.history.replaceState(null,'',`#${id}`)};
 const account=()=>{if(session?.user)setPanel('account');else window.location.assign(login)};
 return <main className="nexora-site">
  <header className="nx-site-nav">
   <Link href="/game" aria-label="NEXORA หน้าหลัก" className="nx-site-brand"><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME"/></Link>
   <nav aria-label="เมนูหลัก"><Link href="/game#news" onClick={scrollToSection('news')}>ข่าว</Link><button type="button" className="nx-world-trigger" ref={worldButton} aria-expanded={worldOpen} aria-controls="nx-world-menu" onPointerEnter={event=>{if(event.pointerType==='mouse')openWorld()}} onPointerLeave={closeWorldSoon} onClick={()=>{if(worldOpen)setWorldOpen(false);else openWorld()}} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();openWorld();requestAnimationFrame(()=>worldMenu.current?.querySelector('a')?.focus())}}}>โลกของ NEXORA<ChevronDown size={14}/></button>{[['tutorials','บทสอนต่อสู้'],['download','ดาวน์โหลด']].map(([id,label])=><Link key={id} href={`/game#${id}`} onClick={scrollToSection(id)}>{label}</Link>)}<Link className="nx-topup-nav" href="/game/topup"><Coins size={18}/>เติม COIN</Link></nav>
   {session?.user?<button className="nx-site-account" onClick={account} aria-label="บัญชี" aria-haspopup="dialog" aria-expanded={panel==='account'}><UserRound size={18}/>บัญชี<span className="nx-nav-avatar" aria-hidden="true">{avatar&&failedAvatar!==avatar?<img src={avatar} alt="" referrerPolicy="no-referrer" onError={()=>setFailedAvatar(avatar)}/>:<UserRound size={20}/>}</span></button>:<Link className="nx-site-account" href={login}><UserRound size={18}/>เข้าสู่ระบบ</Link>}
  </header>
  {worldOpen&&createPortal(<nav id="nx-world-menu" ref={worldMenu} className="nx-world-menu" aria-label="โลกของ NEXORA" style={worldPosition} onPointerEnter={cancelWorldClose} onPointerLeave={closeWorldSoon} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)&&event.relatedTarget!==worldButton.current)setWorldOpen(false)}}>{gameWorldSections.map(item=><Link key={item.id} href={`/game/world/${item.id}`} onClick={()=>setWorldOpen(false)}>{item.title}</Link>)}</nav>,document.body)}
  {children||<><section className="nx-site-hero">
   <img className="nx-site-scene" src="/game-assets/login/website-poster.webp" alt="" fetchPriority="high"/>
   {heroUrl&&<video ref={heroVideo} className="nx-site-scene nx-site-hero-video" src={heroUrl} autoPlay muted loop playsInline aria-hidden="true" onLoadedData={()=>setHeroReady(true)} onError={()=>setHeroReady(false)} style={{opacity:heroReady?1:0}}/>}
   <div className="nx-site-hero-copy"><span className="nx-site-eyebrow">THE NEXT MOVE IS YOURS</span><h1 className="nx-site-hero-brand"><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME" fetchPriority="high"/></h1><p>เลือกการ์ดของคุณ วางกลยุทธ์ของคุณ<br/>แล้วก้าวสู่สนามประลอง</p><div className="nx-site-actions"><a className="nx-site-primary" href="/downloads/game-windows/current"><Download size={22}/>ดาวน์โหลด Windows PC</a><Link className="nx-site-primary nx-topup-link" href="/game/topup"><Coins size={21}/>เติม COIN<ArrowUpRight size={17}/></Link></div><small>Windows 64-bit<span>มือถือ · พบกันในอนาคต</span></small></div>
   <a className="nx-site-explore" href="#news" onClick={scrollToSection('news')}>เข้าสู่โลก NEXORA <span>↓</span></a>
  </section>
  <section id="news" className="nx-site-news" aria-labelledby="nx-news-heading"><div className="nx-news-heading"><span className="nx-site-eyebrow">NEXORA / NEWS</span><h2 id="nx-news-heading">ข่าว</h2></div><div className="nx-news-grid">{['/game-assets/login/website-poster.webp','/images/triad/nexora-world-small.webp','/images/versus/arena.png'].map((image,index)=><button type="button" className="nx-news-card" key={image} aria-label={`โครงข่าว ${index+1}`} aria-pressed={activeNews===index} onClick={()=>setActiveNews(activeNews===index?null:index)}><span className="nx-news-glass" style={{backgroundImage:`url('${image}')`}} aria-hidden="true"/><span className="nx-news-image"><img src={image} alt="" loading="lazy" decoding="async"/></span><span className="nx-news-body"><strong>เร็วๆ นี้</strong><span className="nx-news-skeleton" aria-hidden="true"><i/><i/><i/></span><span className="nx-news-meta"><span>— / — / —</span><span>ข่าวสาร</span></span></span></button>)}</div></section>
  <section id="information" className="nx-site-world"><div id="world"><span className="nx-site-eyebrow">NEXORA / WORLD</span><h2>โลกของ NEXORA</h2><h3>ทุกใบมีจังหวะของมัน</h3><p>การ์ด ธาตุ และทักษะ สู่การประลองที่ตัดสินด้วยแผนของคุณ</p></div><div className="nx-site-modes"><article><span>01 / TRIAD</span><h3>3 ใบ เปลี่ยนเกม</h3><p>สนามประลอง TRIAD</p></article><article><span>02 / PENTAD</span><h3>5 ใบ วางหมาก</h3><p>สนามประลอง PENTAD</p></article></div></section>
  <GameBattleTutorials/>
  <section id="download" className="nx-site-download"><div><span className="nx-site-eyebrow">NEXORA ON PC</span><h2>พร้อมลงสนาม</h2><p>ดาวน์โหลดตัวเกมสำหรับ Windows และเข้าสู่ระบบด้วยบัญชีเดียวกับเว็บไซต์</p></div><a className="nx-site-primary" href="/downloads/game-windows/current"><Download size={22}/>ดาวน์โหลด Windows PC</a></section></>}
  <footer><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA"/><span>© {new Date().getFullYear()} NEXORA CARD GAME</span><button onClick={account}>บัญชีของคุณ <ArrowUpRight size={16}/></button></footer>
  <dialog ref={dialog} className="nx-site-dialog" aria-labelledby="nx-account-heading" onCancel={()=>setPanel(null)} onClick={event=>{if(event.target===event.currentTarget)setPanel(null)}}><div className="nx-site-dialog-body">
   <button className="nx-site-close" title="ปิด" aria-label="ปิด" onClick={()=>setPanel(null)}><X/></button>
   <img className="nx-account-brand" src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME"/>
   <span className="nx-site-eyebrow">NEXORA ACCOUNT</span><h2 id="nx-account-heading">บัญชีของคุณ</h2>
   <div className="nx-account-identity"><span className="nx-account-avatar">{avatar&&failedAvatar!==avatar?<img src={avatar} alt="รูปโปรไฟล์" referrerPolicy="no-referrer" onError={()=>setFailedAvatar(avatar)}/>:<UserRound size={28}/>}</span><div><strong>{session?.user?.name}</strong>{session?.user?.email&&<span>{session.user.email}</span>}</div></div>
   <dl><dt>รหัสบัญชี</dt><dd>{session?.user?.id}</dd><dt>COIN</dt><dd>{wallet?wallet.coin.toLocaleString():walletError?'ไม่สามารถโหลดยอดเงินได้':'กำลังตรวจสอบยอดเงิน'}</dd><dt>NEX</dt><dd>{wallet?wallet.nexPoint.toLocaleString():'—'}</dd></dl>
   <div className="nx-account-actions"><Link className="nx-account-edit" href="/game/account" onClick={()=>setPanel(null)}><Settings2 size={19}/>แก้ไขบัญชี<ArrowUpRight size={16}/></Link><Link className="nx-site-primary" href="/game/topup" onClick={()=>setPanel(null)}><Coins size={20}/>เติม COIN</Link></div>
   <div className="nx-account-bottom"><span><ShieldCheck size={16}/>NEXORA ACCOUNT</span><button className="nx-site-signout" onClick={()=>void signOut({callbackUrl:'/game'})}><LogOut size={18}/>ออกจากระบบ</button></div>
  </div></dialog>
 </main>;
}
