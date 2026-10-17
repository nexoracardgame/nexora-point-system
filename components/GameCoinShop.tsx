"use client";

import {useEffect,useRef,useState} from 'react';
import {useSession} from 'next-auth/react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,Check,Coins,ShieldCheck,Sparkles,UserRound,X} from 'lucide-react';
import {gameCoinPackages} from '@/lib/game-coin-packages';
import './GameCoinShop.css';

const number=(value:number)=>value.toLocaleString('th-TH');
export default function GameCoinShop(){
 const {data:session}=useSession();
 const [selected,setSelected]=useState<string|null>(null);
 const notice=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get('pack');if(gameCoinPackages.some(pack=>pack.id===id))setSelected(id)},[]);
 const pack=gameCoinPackages.find(pack=>pack.id===selected);
 const callback='/game/topup'+(pack?'?pack='+pack.id:'');
 const login='/game/login?callbackUrl='+encodeURIComponent(callback);
 const checkout=()=>{if(!pack)return;if(!session?.user){window.location.assign(login);return}notice.current?.showModal()};
 return <div className="nx-coin-shop">
  <div className="nx-coin-scene" aria-hidden="true"/>
  <div className="nx-coin-content">
   <Link href="/game" className="nx-coin-back"><ArrowLeft size={17}/>NEXORA</Link>
   <header className="nx-coin-heading"><div><span className="nx-site-eyebrow">NEXORA / TOP UP</span><h1>เติม <span>COIN</span></h1><p>เพิ่มพลังให้คอลเลกชันของคุณ</p></div><div className="nx-coin-account"><UserRound size={21}/><div>{session?.user?<><strong>{session.user.name}</strong><span>{session.user.id}</span></>:<Link href={login}>เข้าสู่ระบบบัญชี NEXORA<ArrowRight size={16}/></Link>}</div></div></header>
   <div className="nx-coin-status"><ShieldCheck size={17}/><span>ระบบชำระเงินยังไม่เปิดให้บริการ</span><span>THB · บาทไทย</span></div>
   <fieldset className="nx-coin-packages"><legend>แพ็ก COIN</legend><div className="nx-coin-grid">{gameCoinPackages.map(item=><label className="nx-coin-package" key={item.id} data-selected={selected===item.id}>
    <input type="radio" name="coin-package" value={item.id} checked={selected===item.id} onChange={()=>setSelected(item.id)} aria-label={`${number(item.baht)} บาท รับ ${number(item.total)} COIN`}/>
    <span className="nx-coin-pack-top"><span>{item.bonusPercent?`โบนัส +${item.bonusPercent}%`:'แพ็กเริ่มต้น'}</span><span className="nx-coin-check">{selected===item.id?<Check size={16}/>:null}</span></span>
    <Coins className="nx-coin-symbol" size={42} strokeWidth={1.3}/><strong className="nx-coin-total">{number(item.total)} <span>COIN</span></strong>
    <span className="nx-coin-breakdown">{number(item.base)} COIN {item.bonus>0&&<span>+ {number(item.bonus)} โบนัส</span>}</span>
    <span className="nx-coin-price">฿{number(item.baht)}<span>THB</span></span>
   </label>)}</div></fieldset>
   <p className="nx-coin-footnote"><Sparkles size={16}/>ยอด COIN ที่แสดงรวมโบนัสของแต่ละแพ็กแล้ว</p>
  </div>
  {pack&&<section className="nx-coin-checkout" aria-label="สรุปแพ็กที่เลือก"><div className="nx-coin-checkout-inner"><div className="nx-coin-summary" aria-live="polite"><span>ยอดรับรวม<strong>{number(pack.total)} <small>COIN</small></strong></span><span>ยอดชำระ<strong>฿{number(pack.baht)} <small>THB</small></strong></span></div><button type="button" className="nx-site-primary" onClick={checkout}><ShieldCheck size={19}/>{session?.user?'ชำระเงิน':'เข้าสู่ระบบเพื่อชำระเงิน'}<ArrowRight size={18}/></button></div></section>}
  <dialog ref={notice} className="nx-coin-notice" aria-labelledby="nx-coin-notice-title" onClick={event=>{if(event.target===event.currentTarget)notice.current?.close()}}><div><button className="nx-coin-notice-close" title="ปิด" aria-label="ปิด" onClick={()=>notice.current?.close()}><X/></button><ShieldCheck size={36}/><h2 id="nx-coin-notice-title">ยังไม่เปิดรับชำระเงิน</h2><p>แพ็กที่เลือก: {pack?number(pack.total):''} COIN</p><p>ระบบชำระเงินกำลังเตรียมเปิดให้บริการ ขณะนี้ยังไม่มีการเรียกเก็บเงินหรือเพิ่ม COIN</p><button className="nx-site-primary" onClick={()=>notice.current?.close()}>ตกลง</button></div></dialog>
 </div>;
}
