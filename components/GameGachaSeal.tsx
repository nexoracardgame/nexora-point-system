"use client";
import type {RefObject} from 'react';
import {Coins,ShieldCheck,X} from 'lucide-react';
import {gachaPolicy} from '@/lib/game-gacha';

export default function GameGachaSeal({dialogRef,selected,free,busy,onOpen}:{dialogRef:RefObject<HTMLDialogElement|null>;selected:number;free:boolean;busy:boolean;onOpen:()=>void}){
 return <dialog ref={dialogRef} className="gg-confirm gg-seal" aria-labelledby="gg-confirm-title" data-busy={busy} aria-busy={busy} onCancel={event=>{if(busy)event.preventDefault()}} onClick={event=>{if(!busy&&event.target===event.currentTarget)dialogRef.current?.close()}}>
  <section className="gg-seal-stage" data-pack={selected}>
   <span className="gg-seal-kicker">ASTRAL SEAL</span><h2 id="gg-confirm-title">ซองที่ {selected+1}</h2>
   <div className="gg-seal-art">
    <img className="gg-seal-sigil" src="/battle-fx/magic_01.png" alt="" draggable={false}/>
    <img className="gg-seal-flare" src="/battle-fx/flare_01.png" alt="" draggable={false}/>
    <button type="button" className="gg-seal-card" aria-label="ยืนยันเปิดซอง" disabled={busy} title={free?'เปิดซองทดสอบ ไม่หัก COIN':`เปิดซอง ใช้ ${gachaPolicy.price} COIN`} onClick={onOpen}>
     <span className="gg-foil"><img src="/cards/card-backs/card-backs.png" alt="หลังการ์ดซองที่เลือก" draggable={false}/></span>
     <span className="gg-seal-command" aria-hidden={busy}>ปลดผนึก</span>
    </button>
    <img className="gg-seal-sparks" src="/battle-fx/spark_01.png" alt="" draggable={false}/>
   </div>
   <span className="gg-seal-price"><Coins size={21}/>{free?'GM · ไม่หัก COIN':`${gachaPolicy.price} COIN`}</span>
   <p className="gg-seal-guarantee"><ShieldCheck size={16}/>การ์ด {gachaPolicy.size} ใบ · การันตีถาวร 1 ใบ</p>
   <button type="button" className="gg-seal-cancel" aria-label="ยกเลิก" title="ยกเลิก" disabled={busy} onClick={()=>dialogRef.current?.close()}><X size={18}/><span>ยกเลิก</span></button>
  </section>
 </dialog>;
}
