"use client";
import {useRef} from 'react';

export default function GameGachaPackChoice({selected,locked,canOpen,onSelect,onOpen}:{selected:number;locked:boolean;canOpen:boolean;onSelect:(index:number)=>void;onOpen:(index:number)=>void}){
 const touch=useRef({index:-1,time:0});
 return <>{['left','front','right'].map((position,index)=><button type="button" key={position} className={`gg-pack gg-pack-${position}`} data-pack={index} aria-label={`เลือกซองที่ ${index+1}`} title={`ซองที่ ${index+1} · ดับเบิลคลิกเพื่อเปิด`} aria-pressed={selected===index} disabled={locked}
  onClick={()=>onSelect(index)} onDoubleClick={()=>{if(canOpen&&!locked)onOpen(index)}}
  onPointerUp={event=>{if(event.pointerType==='mouse'||locked)return;const now=performance.now();if(touch.current.index===index&&now-touch.current.time<350&&canOpen){touch.current={index:-1,time:0};onOpen(index)}else touch.current={index,time:now}}}
  onKeyDown={event=>{if(event.key==='Enter'&&canOpen&&!locked){event.preventDefault();onOpen(index)}}}>
  <span className="gg-foil"><img src="/cards/card-backs/card-backs.png" alt="" draggable={false}/></span>
 </button>)}</>;
}
