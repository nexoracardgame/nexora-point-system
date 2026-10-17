"use client";

import {useEffect,useRef,useState} from 'react';
import {useSession,signOut} from 'next-auth/react';
import Link from 'next/link';
import {Download,Coins,UserRound,ArrowUpRight,X,LogOut,ShieldCheck} from 'lucide-react';
import './GameWebsite.css';

export default function GameWebsite(){
 const {data:session}=useSession();
 const [panel,setPanel]=useState<'account'|'coin'|null>(null);
 const [wallet,setWallet]=useState<{coin:number;nexPoint:number}|null>(null);
 const [walletError,setWalletError]=useState(false);
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
 const account=()=>{if(session?.user)setPanel('account');else window.location.assign(login)};
 const coin=()=>{if(session?.user)setPanel('coin');else window.location.assign(login)};
 return <main className="nexora-site">
  <header className="nx-site-nav">
   <Link href="/game" aria-label="NEXORA หน้าหลัก" className="nx-site-brand"><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME"/></Link>
   <nav aria-label="เมนูหลัก"><a href="#world">โลกของ NEXORA</a><a href="#download">ดาวน์โหลด</a><button onClick={coin}><Coins size={18}/>เติม COIN</button></nav>
   <button className="nx-site-account" onClick={account}><UserRound size={18}/>{session?.user?'บัญชี':'เข้าสู่ระบบ'}</button>
  </header>
  <section className="nx-site-hero">
   <img className="nx-site-scene" src="/images/triad/nexora-duelists.webp" alt="นักรบแห่ง NEXORA" fetchPriority="high"/>
   <div className="nx-site-hero-copy"><span className="nx-site-eyebrow">THE NEXT MOVE IS YOURS</span><h1>NEXORA <span>CARD GAME</span></h1><p>เลือกการ์ดของคุณ วางกลยุทธ์ของคุณ<br/>แล้วก้าวสู่สนามประลอง</p><div className="nx-site-actions"><a className="nx-site-primary" href="/downloads/game-windows/current"><Download size={22}/>ดาวน์โหลด Windows PC</a><button onClick={coin}><Coins size={21}/>เติม COIN<ArrowUpRight size={17}/></button></div><small>Windows 64-bit<span>มือถือ · พบกันในอนาคต</span></small></div>
   <a className="nx-site-explore" href="#world">เข้าสู่โลก NEXORA <span>↓</span></a>
  </section>
  <section id="world" className="nx-site-world"><div><span className="nx-site-eyebrow">CHOOSE YOUR BATTLE</span><h2>ทุกใบมีจังหวะของมัน</h2><p>การ์ด ธาตุ และทักษะ สู่การประลองที่ตัดสินด้วยแผนของคุณ</p></div><div className="nx-site-modes"><article><span>01 / TRIAD</span><h3>3 ใบ เปลี่ยนเกม</h3><p>สนามประลอง TRIAD</p></article><article><span>02 / PENTAD</span><h3>5 ใบ วางหมาก</h3><p>สนามประลอง PENTAD</p></article></div></section>
  <section id="download" className="nx-site-download"><div><span className="nx-site-eyebrow">NEXORA ON PC</span><h2>พร้อมลงสนาม</h2><p>ดาวน์โหลดตัวเกมสำหรับ Windows และเข้าสู่ระบบด้วยบัญชีเดียวกับเว็บไซต์</p></div><a className="nx-site-primary" href="/downloads/game-windows/current"><Download size={22}/>ดาวน์โหลด Windows PC</a></section>
  <footer><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA"/><span>© {new Date().getFullYear()} NEXORA CARD GAME</span><button onClick={account}>บัญชีของคุณ <ArrowUpRight size={16}/></button></footer>
  <dialog ref={dialog} className="nx-site-dialog" onCancel={()=>setPanel(null)} onClick={event=>{if(event.target===event.currentTarget)setPanel(null)}}><div className="nx-site-dialog-body"><button className="nx-site-close" title="ปิด" aria-label="ปิด" onClick={()=>setPanel(null)}><X/></button><span className="nx-site-eyebrow">NEXORA ACCOUNT</span><h2>{panel==='coin'?'เติม COIN':'บัญชีของคุณ'}</h2><p>{session?.user?.name}</p><dl><dt>รหัสบัญชี</dt><dd>{session?.user?.id}</dd><dt>COIN</dt><dd>{wallet?wallet.coin.toLocaleString():walletError?'ไม่สามารถโหลดยอดเงินได้':'กำลังตรวจสอบยอดเงิน'}</dd><dt>NEX</dt><dd>{wallet?wallet.nexPoint.toLocaleString():'—'}</dd></dl>{panel==='coin'?<p className="nx-site-notice"><ShieldCheck size={22}/>ระบบเติมเงินยังไม่เปิดให้บริการ ไม่มีการรับชำระเงินในขณะนี้</p>:<><button className="nx-site-primary" onClick={()=>setPanel('coin')}><Coins size={20}/>เติม COIN</button><button className="nx-site-signout" onClick={()=>void signOut({callbackUrl:'/game'})}><LogOut size={18}/>ออกจากระบบ</button></>}</div></dialog>
 </main>;
}
