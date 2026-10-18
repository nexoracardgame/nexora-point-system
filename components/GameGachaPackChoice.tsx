"use client";

export default function GameGachaPackChoice({selected,locked,canOpen,onSelect,onOpen}:{selected:number;locked:boolean;canOpen:boolean;onSelect:(index:number)=>void;onOpen:(index:number)=>void}){
 return <>{['left','front','right'].map((position,index)=><button type="button" key={position} className={`gg-pack gg-pack-${position}`} data-pack={index} aria-label={`เลือกซองที่ ${index+1}`} title={`เลือกซองที่ ${index+1}`} aria-pressed={selected===index} disabled={locked}
  onClick={()=>{if(locked)return;onSelect(index);if(canOpen)onOpen(index)}}>
  <span className="gg-foil"><img src="/cards/card-backs/card-backs.png" alt="" draggable={false}/></span>
 </button>)}</>;
}
