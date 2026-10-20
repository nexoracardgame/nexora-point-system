"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Trophy,Zap} from 'lucide-react';
import './BattleSkipSummary.css';
type Summary={winner:string;player:string;opponent:string;a:number;b:number;reason?:string;metric?:string};
export default function BattleSkipSummary(){
 const [value,setValue]=useState<Summary|null>(null);
 const panel=useRef<HTMLElement>(null),sequence=useRef(0);
 useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const receive=(event:Event)=>{setValue((event as CustomEvent<Summary>).detail);clearTimeout(timer);timer=setTimeout(()=>setValue(null),3000)};window.addEventListener('nexora:round-skipped',receive);return()=>{clearTimeout(timer);window.removeEventListener('nexora:round-skipped',receive)}},[]);
 useLayoutEffect(()=>{
  if(!value||!panel.current)return;sequence.current++;
  const fit=()=>{const node=panel.current;if(!node)return;const width=node.offsetWidth,height=node.offsetHeight,pad=12,x=window.innerWidth-width-pad;
   const blockers=[...document.querySelectorAll<HTMLElement>('.nexora-card-art-frame,.nexora-arena-scoreplate,.nexora-arena-header,.nexora-arena-hand,.heptad-special-hand,.triad-arena-card,[data-game-window-controls]')].filter(item=>!item.closest('.nexora-versus-plane')).map(item=>item.getBoundingClientRect()).filter(rect=>rect.width&&rect.height);
   let best=pad,score=Infinity;
   const preferred=Math.max(pad,(window.innerHeight-height)/2);
   for(let y=pad;y<=window.innerHeight-height-pad;y+=8){const overlap=blockers.reduce((sum,r)=>sum+Math.max(0,Math.min(x+width+8,r.right)-Math.max(x-8,r.left))*Math.max(0,Math.min(y+height+8,r.bottom)-Math.max(y-8,r.top)),0);const rank=overlap*1000+Math.abs(y-preferred);if(rank<score){score=rank;best=y;}}
   node.style.top=`${best}px`;};
  fit();const frame=requestAnimationFrame(fit);window.addEventListener('resize',fit);return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',fit);};
 },[value]);
 return value?createPortal(<section ref={panel} key={`${sequence.current}:${value.a}:${value.b}:${value.winner}`} className="battle-skip-summary" role="status" aria-live="polite"><header><Trophy size={16}/><strong>{value.winner==='draw'?'ตานี้เสมอ':'ผู้ชนะตานี้'}</strong><span>ROUND RESULT</span></header><h2>{value.winner==='draw'?'เสมอ':value.winner==='player'?value.player:value.opponent}</h2><div className="bss-scores">{([{name:value.player,power:value.a,side:'player'},{name:value.opponent,power:value.b,side:'opponent'}]).map(row=><div key={row.side} data-winner={value.winner===row.side}><span>{row.name}</span><b>{row.power.toLocaleString()}</b></div>)}</div><footer><Zap size={14}/><span>{value.reason||`ตัดสินด้วย ${value.metric==='attack'?'ATTACK':value.metric==='support'?'SUPPORT':'พลังรวม'}`}</span></footer><small>ส่วนต่างพลัง <b>{Math.abs(value.a-value.b).toLocaleString()}</b></small><i className="bss-timer"/></section>,document.body):null;
}
