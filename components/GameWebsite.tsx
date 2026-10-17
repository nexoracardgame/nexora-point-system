"use client";

import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useSession,signOut} from 'next-auth/react';
import Link from 'next/link';
import {Download,Coins,UserRound,ArrowUpRight,X,LogOut,ShieldCheck,Settings2} from 'lucide-react';
import './GameWebsite.css';
import GameBattleTutorials from './GameBattleTutorials';

export default function GameWebsite({children}:{children?:ReactNode}){
 const {data:session}=useSession();
 const [panel,setPanel]=useState<'account'|null>(null);
 const [wallet,setWallet]=useState<{coin:number;nexPoint:number}|null>(null);
 const [walletError,setWalletError]=useState(false);
 const [failedAvatar,setFailedAvatar]=useState<string|null>(null);
 const avatar=session?.user?.image||'';
 const dialog=useRef<HTMLDialogElement>(null);
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
  if(children||window.location.hash!=='#tutorials')return;
  const frame=requestAnimationFrame(()=>document.getElementById('tutorials')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
  return()=>cancelAnimationFrame(frame);
 },[children]);
 const account=()=>{if(session?.user)setPanel('account');else window.location.assign(login)};
 return <main className="nexora-site">
  <header className="nx-site-nav">
   <Link href="/game" aria-label="NEXORA หน้าหลัก" className="nx-site-brand"><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME"/></Link>
   <nav aria-label="เมนูหลัก"><Link href="/game#world">โลกของ NEXORA</Link><Link href="/game#tutorials" onClick={event=>{const section=document.getElementById('tutorials');if(!section)return;event.preventDefault();section.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});window.history.replaceState(null,'','#tutorials')}}>บทสอนต่อสู้</Link><Link href="/game#download">ดาวน์โหลด</Link><Link className="nx-topup-nav" href="/game/topup"><Coins size={18}/>เติม COIN</Link></nav>
   {session?.user?<button className="nx-site-account" onClick={account} aria-label="บัญชี" aria-haspopup="dialog" aria-expanded={panel==='account'}><UserRound size={18}/>บัญชี<span className="nx-nav-avatar" aria-hidden="true">{avatar&&failedAvatar!==avatar?<img src={avatar} alt="" referrerPolicy="no-referrer" onError={()=>setFailedAvatar(avatar)}/>:<UserRound size={20}/>}</span></button>:<Link className="nx-site-account" href={login}><UserRound size={18}/>เข้าสู่ระบบ</Link>}
  </header>
  {children||<><section className="nx-site-hero">
   <img className="nx-site-scene" src="/images/triad/nexora-duelists.webp" alt="นักรบแห่ง NEXORA" fetchPriority="high"/>
   <div className="nx-site-hero-copy"><span className="nx-site-eyebrow">THE NEXT MOVE IS YOURS</span><h1 className="nx-site-hero-brand"><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME" fetchPriority="high"/></h1><p>เลือกการ์ดของคุณ วางกลยุทธ์ของคุณ<br/>แล้วก้าวสู่สนามประลอง</p><div className="nx-site-actions"><a className="nx-site-primary" href="/downloads/game-windows/current"><Download size={22}/>ดาวน์โหลด Windows PC</a><Link className="nx-site-primary nx-topup-link" href="/game/topup"><Coins size={21}/>เติม COIN<ArrowUpRight size={17}/></Link></div><small>Windows 64-bit<span>มือถือ · พบกันในอนาคต</span></small></div>
   <a className="nx-site-explore" href="#world">เข้าสู่โลก NEXORA <span>↓</span></a>
  </section>
  <section id="world" className="nx-site-world"><div><span className="nx-site-eyebrow">CHOOSE YOUR BATTLE</span><h2>ทุกใบมีจังหวะของมัน</h2><p>การ์ด ธาตุ และทักษะ สู่การประลองที่ตัดสินด้วยแผนของคุณ</p></div><div className="nx-site-modes"><article><span>01 / TRIAD</span><h3>3 ใบ เปลี่ยนเกม</h3><p>สนามประลอง TRIAD</p></article><article><span>02 / PENTAD</span><h3>5 ใบ วางหมาก</h3><p>สนามประลอง PENTAD</p></article></div></section>
  <GameBattleTutorials/>
  <section id="download" className="nx-site-download"><div><span className="nx-site-eyebrow">NEXORA ON PC</span><h2>พร้อมลงสนาม</h2><p>ดาวน์โหลดตัวเกมสำหรับ Windows และเข้าสู่ระบบด้วยบัญชีเดียวกับเว็บไซต์</p></div><a className="nx-site-primary" href="/downloads/game-windows/current"><Download size={22}/>ดาวน์โหลด Windows PC</a></section></>}
  <footer><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA"/><span>© {new Date().getFullYear()} NEXORA CARD GAME</span><button onClick={account}>บัญชีของคุณ <ArrowUpRight size={16}/></button></footer>
  <dialog ref={dialog} className="nx-site-dialog" aria-labelledby="nx-account-heading" onCancel={()=>setPanel(null)} onClick={event=>{if(event.target===event.currentTarget)setPanel(null)}}><div className="nx-site-dialog-body">
   <button className="nx-site-close" title="ปิด" aria-label="ปิด" onClick={()=>setPanel(null)}><X/></button>
   <img className="nx-account-brand" src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME"/>
   <span className="nx-site-eyebrow">NEXORA ACCOUNT</span><h2 id="nx-account-heading">บัญชีของคุณ</h2>
   <div className="nx-account-identity"><span className="nx-account-avatar"><UserRound size={28}/></span><div><strong>{session?.user?.name}</strong>{session?.user?.email&&<span>{session.user.email}</span>}</div></div>
   <dl><dt>รหัสบัญชี</dt><dd>{session?.user?.id}</dd><dt>COIN</dt><dd>{wallet?wallet.coin.toLocaleString():walletError?'ไม่สามารถโหลดยอดเงินได้':'กำลังตรวจสอบยอดเงิน'}</dd><dt>NEX</dt><dd>{wallet?wallet.nexPoint.toLocaleString():'—'}</dd></dl>
   <div className="nx-account-actions"><Link className="nx-account-edit" href="/settings/profile"><Settings2 size={19}/>แก้ไขบัญชี<ArrowUpRight size={16}/></Link><Link className="nx-site-primary" href="/game/topup" onClick={()=>setPanel(null)}><Coins size={20}/>เติม COIN</Link></div>
   <div className="nx-account-bottom"><span><ShieldCheck size={16}/>NEXORA ACCOUNT</span><button className="nx-site-signout" onClick={()=>void signOut({callbackUrl:'/game'})}><LogOut size={18}/>ออกจากระบบ</button></div>
  </div></dialog>
 </main>;
}
