"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useSession} from 'next-auth/react';
import {Coins,Info,PackageOpen,ShieldCheck,X} from 'lucide-react';
import {gachaPolicy,gachaCatalog,type GachaReceipt,type GachaState} from '@/lib/game-gacha';
import {triadCardByNo} from '@/lib/triad-dominion';
import {gameCardThumbnail} from '@/lib/game-card-art';
import {invalidateGameCollection} from '@/lib/game-collection-client';
import {playGameUiSound} from '@/lib/game-ui-audio';
import GameBackControl from './GameBackControl';
import GamePageLogo from './GamePageLogo';
import GameGachaResults from './GameGachaResults';
import GameGachaBackground from './GameGachaBackground';
import GameGachaPackChoice from './GameGachaPackChoice';
import GameGachaSeal from './GameGachaSeal';
import './GameGacha.css';

export default function GameGacha(){
 const {data:session}=useSession(),owner=session?.user?.id||'';
 const liveOwner=useRef(owner);liveOwner.current=owner;
 const [open,setOpen]=useState(false),[state,setState]=useState<GachaState|null>(null),[error,setError]=useState(''),[phase,setPhase]=useState<'idle'|'waiting'|'result'>('idle'),[receipt,setReceipt]=useState<GachaReceipt|null>(null),[pending,setPending]=useState(false),[rates,setRates]=useState(false);
 const root=useRef<HTMLElement>(null),trigger=useRef<HTMLElement|null>(null),confirm=useRef<HTMLDialogElement>(null),inFlight=useRef(false);
 const stateRevision=useRef(0);
 const [selectedPack,setSelectedPack]=useState(1);
 const storageKey='nexora-gacha-pending:'+owner;
 const refresh=useCallback(async()=>{if(!owner)return;const revision=stateRevision.current;try{const response=await fetch('/api/game-gacha',{cache:'no-store'}),value=await response.json();if(!response.ok)throw Error(value.error||'โหลดข้อมูลไม่สำเร็จ');if(liveOwner.current===owner&&revision===stateRevision.current)setState(value)}catch(reason){if(liveOwner.current===owner)setError(reason instanceof Error?reason.message:'โหลดไม่สำเร็จ')}},[owner]);
 useEffect(()=>{setOpen(false);setState(null);setReceipt(null);setPhase('idle');inFlight.current=false;setError('');if(owner)void refresh()},[owner,refresh]);
 useEffect(()=>{const show=()=>{if(!owner)return;trigger.current=document.activeElement as HTMLElement;setOpen(true);setError('');try{setPending(Boolean(localStorage.getItem(storageKey)));const saved=Number(localStorage.getItem(storageKey+':pack')??1);setSelectedPack([0,1,2].includes(saved)?saved:1)}catch{setPending(false)}void refresh()};window.addEventListener('nexora:open-gacha',show);return()=>window.removeEventListener('nexora:open-gacha',show)},[owner,storageKey,refresh]);
 useEffect(()=>{if(open){if(rates)root.current?.querySelector<HTMLButtonElement>('.gg-rates button')?.focus();else root.current?.focus()}},[open,rates]);
 useEffect(()=>{if(!receipt)return;const images=receipt.cards.slice(0,7).map(card=>{const image=new Image();image.decoding='async';image.src=gameCardThumbnail(card.cardNo)||triadCardByNo.get(card.cardNo)?.sourceImage||'/cards/card-backs/card-backs.png';void image.decode().catch(()=>{});return image});return()=>images.forEach(image=>{image.onload=null;image.onerror=null})},[receipt]);
 const back=()=>{if(inFlight.current)return;if(rates){setRates(false);return}if(phase==='result'){setPhase('idle');return}setOpen(false);setRates(false);requestAnimationFrame(()=>trigger.current?.focus())};
 useEffect(()=>{if(!open)return;const key=(event:KeyboardEvent)=>{if(confirm.current?.open)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();back()}if(event.key==='Tab'){const scope=rates?root.current?.querySelector('.gg-rates'):root.current;const controls=[...scope?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],summary')||[]].filter(node=>node.getClientRects().length),first=controls[0],last=controls.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){event.preventDefault();last?.focus()}else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===root.current)){event.preventDefault();first?.focus()}}};const navigate=(event:Event)=>{event.preventDefault();back()};document.addEventListener('keydown',key,true);window.addEventListener('nexora:navigate-back',navigate);return()=>{document.removeEventListener('keydown',key,true);window.removeEventListener('nexora:navigate-back',navigate)}},[open,phase,rates]);
 const purchase=async()=>{
  if(!owner||inFlight.current)return;
  inFlight.current=true;setReceipt(null);setPhase('waiting');setError('');playGameUiSound('confirm');let requestId='';
  try{
   const existing=localStorage.getItem(storageKey);requestId=existing||crypto.randomUUID();if(!existing)localStorage.setItem(storageKey+':pack',String(selectedPack));localStorage.setItem(storageKey,requestId);setPending(true);
   const response=await fetch('/api/game-gacha',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,policyVersion:gachaPolicy.version,packIndex:Number(localStorage.getItem(storageKey+':pack')??1)}),signal:AbortSignal.timeout(25000)});
   const value=await response.json();
   if(liveOwner.current!==owner)return;
   if(!response.ok){if(response.status>=400&&response.status<500&&response.status!==409){localStorage.removeItem(storageKey);localStorage.removeItem(storageKey+':pack');setPending(false)}throw Error(value.error||'ยังยืนยันผลไม่ได้')}
   // Receipt is already committed. UI effects never decide rewards or balances.
   stateRevision.current++;setReceipt(value.receipt);setState(previous=>({coin:value.coin,unlimitedCoin:value.unlimitedCoin,history:[value.receipt,...(previous?.history||[]).filter(item=>item.id!==value.receipt.id)].slice(0,10)}));
   try{localStorage.removeItem(storageKey);localStorage.removeItem(storageKey+':pack')}catch{}setPending(false);invalidateGameCollection(owner);window.dispatchEvent(new Event('nexora:collection-updated'));window.dispatchEvent(new Event('nexora:wallet-updated'));
   confirm.current?.close();setPhase('result');
  }catch(reason){if(liveOwner.current===owner){confirm.current?.close();setError(reason instanceof Error?reason.message:'ยังยืนยันผลไม่ได้ กรุณาตรวจผลคำขอเดิม');setPhase('idle')}}finally{if(liveOwner.current===owner)inFlight.current=false}
 };
 if(!open||!owner)return null;
 return createPortal(<section className="game-gacha" role="dialog" aria-modal="true" aria-label="เปิดสุ่มการ์ด" ref={root} tabIndex={-1} data-phase={phase} data-stars={receipt?.maxStars||1}>
  <GameGachaBackground/>
  <header className="gg-header"><GameBackControl onBack={back}/><GamePageLogo/><div><h1>เปิดสุ่มการ์ด</h1><span>NEXORA / ASTRAL ARCHIVE</span></div></header>
  {error&&<div className="gg-error" role="alert">{error}<button type="button" aria-label="ปิดข้อความ" title="ปิดข้อความ" onClick={()=>setError('')}><X size={17}/></button></div>}
  {phase==='result'&&receipt?<GameGachaResults key={receipt.id} receipt={receipt} onClose={()=>{setPhase('idle');setReceipt(null)}}/>:
  <main className="gg-main"><section className="gg-banner"><span className="gg-wallet"><Coins size={19}/>{state?.unlimitedCoin?'∞':state?.coin.toLocaleString()??'—'} <small>COIN</small></span><span className="gg-kicker">THE ASTRAL SUMMON</span><h2>ผนึกแห่งดวงดาว</h2><p>มอนสเตอร์และสกิล {gachaCatalog.length} ใบในกล่องเดียว</p><span className="gg-guarantee"><ShieldCheck size={18}/>การันตีการ์ดถาวร 1 ใบทุกซอง</span><div className="gg-pack-stage" aria-label="ซองสุ่มการ์ด NEXORA"><span className="gg-beam"/><GameGachaPackChoice selected={selectedPack} locked={phase==='waiting'||pending} canOpen={Boolean(state&&(state.unlimitedCoin||state.coin>=gachaPolicy.price))} onSelect={setSelectedPack} onOpen={index=>{setSelectedPack(index);confirm.current?.showModal()}}/><span className="gg-pack-caption">7 CARDS / ONE DESTINY</span></div><div className="gg-open-actions">{phase==='waiting'?<span className="gg-summoning-pulse" role="status" aria-label="กำลังเปิดซอง"/>:<><button type="button" className="gg-purchase" disabled={!pending&&(!state||(!state.unlimitedCoin&&state.coin<79))} onClick={()=>pending?void purchase():confirm.current?.showModal()}><PackageOpen size={22}/>{pending?'ตรวจผลคำขอเดิม':'เปิด 1 ซอง'}<span><Coins size={18}/>{pending?'ไม่หักซ้ำ':state?.unlimitedCoin?'GM · ไม่หัก COIN':'79 COIN'}</span></button>{state&&!state.unlimitedCoin&&state.coin<79&&!pending&&<button type="button" className="gg-topup" onClick={()=>window.open('https://nexora-point-system.vercel.app/game/topup','_blank','noopener,noreferrer')}>เติม COIN</button>}</>}</div><button type="button" className="gg-rate-toggle" onClick={()=>setRates(!rates)} aria-expanded={rates}><Info size={16}/>อัตราสุ่มและรายชื่อการ์ด</button></section>
  </main>}
  {rates&&<div className="gg-rates-overlay" onClick={event=>{if(event.target===event.currentTarget)setRates(false)}}><aside className="gg-rates" aria-label="อัตราสุ่ม"><GameGachaBackground shared/><div className="gg-rates-scroll"><header><h2>อัตราสุ่มต่อซอง</h2><button type="button" aria-label="ปิดอัตราสุ่ม" title="ปิดอัตราสุ่ม" onClick={()=>setRates(false)}><X/></button></header><p>{gachaPolicy.price} COIN · การ์ด {gachaPolicy.size} ใบ · การันตีถาวร 1 ใบ</p><div className="gg-rates-columns"><table><thead><tr><th>ดาวสูงสุดในซอง</th><th>โอกาสต่อซอง</th></tr></thead><tbody>{gachaPolicy.starWeights.map(weight=>`${(weight*100/gachaPolicy.starDenominator).toLocaleString('en-US',{maximumFractionDigits:2})}%`).map((text,index)=><tr key={text}><td>{index+1} ดาว</td><td>{text}</td></tr>)}</tbody></table><div className="gg-rates-rules"><p>การ์ดในซองอาจซ้ำกันได้ · ลุ้นดาวสูงสุด 1 ใบ อีก 6 ใบเป็น 1 ดาว · แต่ละใบมีโอกาสเป็นมอนสเตอร์/สกิลอย่างละ 50% แล้วเลือกเท่ากันในกลุ่มดาวและประเภทนั้น</p><p>ถาวร 1 ใบแน่นอน ตำแหน่งสุ่มเท่ากันทุกใบ · มีโอกาส {100/gachaPolicy.extraPermanentDenominator}% ต่อซองที่จะได้ถาวรเพิ่มอีก 1 ใบ (สูงสุด 2 ถาวรต่อซอง)</p><p>ใบที่ไม่ถาวร: 1 วัน 60% · 3 วัน 25% · 7 วัน 10% · 14 วัน 5% ไม่มีสะสมแต้มการันตีดาวสูง และเปิดครบ 100 ซองไม่ได้รับประกัน 5 ดาว</p><details><summary>รายชื่อการ์ดและระดับดาวทั้งหมด ({gachaCatalog.length})</summary><ul>{gachaCatalog.map(card=><li key={card.cardNo}>#{card.cardNo} {triadCardByNo.get(card.cardNo)?.name} · {card.stars}★ · {card.kind==='skill'?'สกิล':'มอนสเตอร์'}</li>)}</ul></details></div></div></div></aside></div>}
  <GameGachaSeal dialogRef={confirm} selected={selectedPack} busy={phase==='waiting'} free={Boolean(state?.unlimitedCoin)} onOpen={()=>void purchase()}/>
 </section>,document.body);
}
