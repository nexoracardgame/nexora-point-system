"use client";
import {useState} from 'react';
import {Layers,Star,X} from 'lucide-react';
import type {GachaReceipt} from '@/lib/game-gacha';
import {triadCardByNo} from '@/lib/triad-dominion';
import {gameCardThumbnail} from '@/lib/game-card-art';
import {playGameUiSound} from '@/lib/game-ui-audio';

export default function GameGachaResults({receipt,onClose}:{receipt:GachaReceipt;onClose:()=>void}){
 const [revealed,setRevealed]=useState<boolean[]>(()=>receipt.cards.map(()=>false));
 const [allFlash,setAllFlash]=useState(false);
 const count=revealed.filter(Boolean).length;
 const reveal=(index?:number)=>{setRevealed(previous=>previous.map((value,i)=>value||index===undefined||index===i));if(index===undefined)setAllFlash(true);playGameUiSound('confirm')};
 return <main className="gg-results" data-all-flash={allFlash}>
  <header><span>ARCHIVE UNSEALED</span><h2>ได้รับการ์ด 7 ใบ</h2><p role="status" aria-live="polite">หงายแล้ว {count} / {receipt.cards.length} ใบ · บันทึกเข้าคลังแล้ว</p></header>
  <div className="gg-rewards">{receipt.cards.map((reward,index)=>{
   const card=triadCardByNo.get(reward.cardNo),name=card?.name||`No.${reward.cardNo}`,shown=revealed[index];
   return <article className="gg-reward" key={index} data-stars={shown?reward.stars:0} data-revealed={shown} aria-label={`รางวัล ${index+1}`}>
    <button type="button" className="gg-flip" aria-label={shown?name:`หงายการ์ดใบที่ ${index+1}`} aria-pressed={shown} aria-disabled={shown} onClick={()=>{if(!shown)reveal(index)}}>
     <span className="gg-flip-inner"><span className="gg-card-back" aria-hidden="true"><img src="/cards/card-backs/card-backs.png" alt="" draggable={false}/></span><span className="gg-card-front" aria-hidden={!shown}><img src={gameCardThumbnail(reward.cardNo)||card?.sourceImage||'/cards/card-backs/card-backs.png'} alt={shown?name:''} draggable={false} decoding="async"/></span></span><span className="gg-warp" aria-hidden="true"/>
    </button>
    <div className="gg-reward-info" aria-hidden={!shown} inert={!shown}>
     <span className="gg-stars" aria-label={`${reward.stars} ดาว`}>{Array.from({length:reward.stars},(_,i)=><Star key={i} size={13} fill="currentColor"/>)}</span><strong>{name}</strong><span className="gg-duration" data-permanent={!reward.days}>{reward.days?`${reward.days} วัน`:reward.guaranteedPermanent?'ถาวร · การันตี':'ถาวร · โบนัส'}</span>{reward.expiresAt&&<small>ถึง {new Date(reward.expiresAt).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'})}</small>}
    </div>
   </article>
  })}</div>
  <div className="gg-result-actions"><button type="button" disabled={count===receipt.cards.length} onClick={()=>reveal()}><Layers size={18}/>หงายทั้งหมด</button><button type="button" onClick={onClose}><X size={18}/>ปิด</button></div>
  <small className="gg-receipt">รหัสผลสุ่ม {receipt.id}</small>
 </main>;
}
