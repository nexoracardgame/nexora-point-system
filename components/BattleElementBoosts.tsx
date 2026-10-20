"use client";
import {useLayoutEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {triadCardByNo} from '@/lib/triad-dominion';
import './BattleElementBoosts.css';
export function ElementBoostCard({no,used=false}:{no:string;used?:boolean}){
 const card=triadCardByNo.get(no);return card?<aside key={no} className="battle-element-boost" data-used={used}><strong>{used?'การ์ดเสริมธาตุ':'ได้รับการ์ดเสริมธาตุ'}</strong><img src={card.sourceImage} alt={card.name}/><span>{used?'ใช้แล้ว':card.name}</span></aside>:null;
}
export default function BattleElementBoosts({boosts,used,mode}:{boosts:Partial<Record<'host'|'challenger',string>>;used:boolean|Partial<Record<'host'|'challenger',boolean>>;mode:'heptad'|'pentad'}){
 const [positions,setPositions]=useState<Record<string,{left:number;top:number;width:number}>>({});
 useLayoutEffect(()=>{let frame=0;
  const measure=()=>{const next:typeof positions={};for(const side of ['host','challenger'] as const){
   const selector=mode==='heptad'?`.heptad-arena-side[data-side="${side}"] .heptad-slot[data-turn="1"]`:`[data-pentad-side="${side}"] [data-arena-slot="0"] button`;
   const r=document.querySelector(selector)?.getBoundingClientRect();if(!r||!boosts[side])continue;
   const width=Math.max(28,r.width*.65),left=r.right+width+16<innerWidth?r.right+8:r.left-width-8;next[side]={left,top:r.top,width};
  }setPositions(next)};
  measure();frame=requestAnimationFrame(measure);window.addEventListener('resize',measure);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',measure)};
 },[boosts.host,boosts.challenger,mode]);
 return createPortal(<>{Object.entries(positions).map(([side,style])=><div key={side} style={{...style,position:'fixed',zIndex:104,pointerEvents:'none'}}><ElementBoostCard no={boosts[side as 'host']||''} used={typeof used==='boolean'?used:used[side as 'host']}/></div>)}</>,document.body);
}
