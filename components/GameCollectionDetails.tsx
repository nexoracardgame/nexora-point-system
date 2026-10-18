"use client";
import {X,Star,Swords,Shield} from 'lucide-react';
import type {TriadCard} from '@/lib/triad-dominion';
import type {OwnedGameCard} from '@/lib/game-collection';
import {gameCardThumbnail} from '@/lib/game-card-art';
import {rateMonster} from '@/lib/game-monster-rating';
import {rateGameSkill} from '@/lib/game-skill-rating';
export default function GameCollectionDetails({card,owned,onClose}:{card:TriadCard;owned?:OwnedGameCard;onClose:()=>void}){
 const rating=card.kind==='skill'?rateGameSkill(card):rateMonster(card);
 return <section className="gcc-details" aria-label="ข้อมูลการ์ด" key={card.cardNo}>
  <header><span>#{card.cardNo} · {card.kind==='skill'?'สกิล':'มอนสเตอร์'}</span><button className="gcc-icon" aria-label="ปิดข้อมูลการ์ด" title="ปิดข้อมูลการ์ด" onClick={onClose}><X size={17}/></button></header>
  <div className="gcc-details-body"><img src={gameCardThumbnail(card.cardNo)||card.sourceImage} alt={card.name} decoding="async"/><div className="gcc-details-copy"><span className="gcc-card-rating" aria-label={`${rating.stars} ดาว`}>{Array.from({length:rating.stars},(_,i)=><Star key={i} size={12} fill="currentColor"/>)}</span><h2>{card.name}</h2><div className="gcc-details-stats"><span><Swords size={14}/> ATK <b>{card.attack.toLocaleString()}</b></span><span><Shield size={14}/> SUP <b>{card.support.toLocaleString()}</b></span></div><p>{card.skillText||'ไม่มีสกิลพิเศษ'}</p><footer>{owned?<><span>ถาวร {owned.permanentQuantity??owned.quantity} ใบ</span><span>รายวัน {owned.temporaryQuantity||0} ใบ</span>{owned.expiresAt&&<small>หมดอายุถัดไป {new Date(owned.expiresAt).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'})}</small>}</>:'ยังไม่ได้เป็นเจ้าของ'}</footer></div></div>
 </section>;
}
