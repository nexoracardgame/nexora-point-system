"use client";
import type {CSSProperties} from 'react';
import {triadCardByNo} from '@/lib/triad-dominion';
import {useCardGesture} from '@/lib/use-card-gesture';
import {BattleArenaCardFrame} from './BattleArenaHud';
import './HeptadSpecialHand.css';
function SpecialCard({no,index,count,enabled,onChoose,onPreview,onPreviewEnd}:{no:string;index:number;count:number;enabled:boolean;onChoose:(no:string)=>void;onPreview:(no:string)=>void;onPreviewEnd:()=>void}){
 const card=triadCardByNo.get(no),gesture=useCardGesture({disabled:!enabled,onChoose:()=>onChoose(no),onPreview:()=>onPreview(no),onPreviewEnd});
 return card?<button {...gesture} type="button" className="heptad-special-hand-card" aria-label={`เสริมพิเศษ ${card.name}`} aria-disabled={!enabled} style={{'--fan-angle':`${(index-(count-1)/2)*5}deg`,'--fan-index':index} as CSSProperties}><BattleArenaCardFrame><img src={card.sourceImage} alt={card.name} draggable={false}/></BattleArenaCardFrame></button>:null;
}
export default function HeptadSpecialHand({cards,enabled,prompt,message,used,limit,onChoose,onDecline,onPreview,onPreviewEnd}:{cards:string[];enabled:boolean;prompt:boolean;message:string;used:number;limit:number;onChoose:(no:string)=>void;onDecline:()=>void;onPreview:(no:string)=>void;onPreviewEnd:()=>void}){
 return <aside className="heptad-special-hand" data-prompt={prompt} aria-label="มือการ์ดเสริมพิเศษ"><header><strong>การ์ดเสริมพิเศษ</strong><span>{cards.length} ใบ · ใช้ {used}/{limit}</span></header>{prompt&&<p role="status">{message}</p>}<div className="heptad-special-hand-fan">{cards.map((no,index)=><SpecialCard key={no} no={no} index={index} count={cards.length} enabled={enabled} onChoose={onChoose} onPreview={onPreview} onPreviewEnd={onPreviewEnd}/>)}</div>{!cards.length&&<span>ใช้การ์ดเสริมพิเศษครบแล้ว</span>}{enabled&&<button className="heptad-primary" onClick={onDecline}>ไม่ใช้การ์ดเสริมพิเศษ</button>}</aside>;
}
