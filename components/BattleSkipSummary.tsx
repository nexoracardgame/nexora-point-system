"use client";
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
type Summary={winner:string;player:string;opponent:string;a:number;b:number};
export default function BattleSkipSummary(){
 const [value,setValue]=useState<Summary|null>(null);
 useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const receive=(event:Event)=>{setValue((event as CustomEvent<Summary>).detail);clearTimeout(timer);timer=setTimeout(()=>setValue(null),3000)};window.addEventListener('nexora:round-skipped',receive);return()=>{clearTimeout(timer);window.removeEventListener('nexora:round-skipped',receive)}},[]);
 return value?createPortal(<section key={`${value.a}:${value.b}:${value.winner}`} className="battle-skip-summary" role="status"><strong>{value.winner==='draw'?'ตานี้เสมอ':`${value.winner==='player'?value.player:value.opponent} ชนะตานี้`}</strong><span>{value.player} {value.a.toLocaleString()} · {value.opponent} {value.b.toLocaleString()}</span><small>ส่วนต่างพลัง {Math.abs(value.a-value.b).toLocaleString()}</small></section>,document.body):null;
}
