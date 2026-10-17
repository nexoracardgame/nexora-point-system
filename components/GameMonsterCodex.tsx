"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,ArrowRight,Search,Shield,Skull,Star,Swords,X} from 'lucide-react';
import {gameMonsters,describeMonster,monsterElements,monsterThumbnail,warmMonsterImages} from '@/lib/game-monsters';
import type {TriadCard} from '@/lib/triad-dominion';
import GameBackControl from './GameBackControl';
import GamePageLogo from './GamePageLogo';
import './GameMonsterCodex.css';

function Stars({count}:{count:number}){return <span className="gmc-stars" aria-label={`ระดับพลังเบื้องต้น ${count} ดาว`}>{[1,2,3,4,5].map(value=><Star key={value} size={14} fill={value<=count?'currentColor':'none'} data-filled={value<=count}/>)}</span>}
function MonsterArtwork({card}:{card:TriadCard}){
 const [ready,setReady]=useState(false);const artwork=describeMonster(card).characterArt||card.sourceImage;
 return <div className="gmc-character-art"><img className="gmc-character-preview" src={monsterThumbnail(card)} alt=""/><img className="gmc-character-full" src={artwork} alt={card.name} decoding="async" onLoad={()=>setReady(true)} onError={()=>setReady(false)} style={{opacity:ready?1:0}}/></div>;
}
export default function GameMonsterCodex(){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[element,setElement]=useState('all'),[stars,setStars]=useState('all'),[sort,setSort]=useState('number'),[selected,setSelected]=useState<TriadCard|null>(null);
 const root=useRef<HTMLElement>(null),grid=useRef<HTMLDivElement>(null),trigger=useRef<HTMLElement|null>(null),lastCard=useRef<string|null>(null);
 const filtered=useMemo(()=>gameMonsters.filter(card=>(element==='all'||element===card.element)&&(stars==='all'||describeMonster(card).stars===Number(stars))&&(!query.trim()||[card.name,card.cardNo,card.skillText].some(value=>value.toLowerCase().includes(query.trim().toLowerCase())))).sort((a,b)=>sort==='attack'?b.attack-a.attack:sort==='support'?b.support-a.support:sort==='stars'?describeMonster(b).stars-describeMonster(a).stars:Number(a.cardNo)-Number(b.cardNo)),[query,element,stars,sort]);
 const close=useCallback(()=>{setOpen(false);setSelected(null);requestAnimationFrame(()=>trigger.current?.focus())},[]);
 const back=useCallback(()=>{if(selected){setSelected(null);requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(`[data-monster="${lastCard.current}"]`)?.focus())}else close()},[selected,close]);
 useEffect(()=>{const show=()=>{trigger.current=document.activeElement as HTMLElement;setSelected(null);setOpen(true)};window.addEventListener('nexora:open-monsters',show);const cleanup=warmMonsterImages(gameMonsters);return()=>{window.removeEventListener('nexora:open-monsters',show);cleanup()}},[]);
 useEffect(()=>{if(open)root.current?.focus()},[open]);
 useEffect(()=>{grid.current?.scrollTo({top:0})},[query,element,stars,sort]);
 const index=selected?filtered.findIndex(card=>card.cardNo===selected.cardNo):-1;
 const next=(direction:number)=>{if(!filtered.length)return;const card=filtered[(index+direction+filtered.length)%filtered.length];lastCard.current=card.cardNo;setSelected(card)};
 useEffect(()=>{if(!open||!selected)return;return warmMonsterImages([selected,filtered[(index+1)%filtered.length],filtered[(index-1+filtered.length)%filtered.length]].filter(Boolean),true)},[open,selected,index,filtered]);
 useEffect(()=>{
  if(!open)return;
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();back()}
   const editing=event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement;
   if(!editing&&selected&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();next(event.key==='ArrowLeft'?-1:1)}
   if(event.key==='Tab'){const controls=[...root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,[tabindex="0"]')||[]].filter(node=>node.getClientRects().length);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){event.preventDefault();last?.focus()}else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===root.current)){event.preventDefault();first?.focus()}}
  };
  const navigateBack=(event:Event)=>{event.preventDefault();back()};document.addEventListener('keydown',key,true);window.addEventListener('nexora:navigate-back',navigateBack);return()=>{document.removeEventListener('keydown',key,true);window.removeEventListener('nexora:navigate-back',navigateBack)};
 },[open,selected,back,index,filtered]);
 if(!open)return null;
 const details=selected?describeMonster(selected):null;
 return createPortal(<section className="game-monster-codex" role="dialog" aria-modal="true" aria-label="สารานุกรมมอนสเตอร์" tabIndex={-1} ref={root}>
  <header className="gmc-header"><GameBackControl onBack={back}/><GamePageLogo/><div><h1>มอนสเตอร์</h1><span>NEXORA / MONSTER ARCHIVE</span></div><span className="gmc-count">{gameMonsters.length} ตัว</span></header>
  {!selected?<>
   <div className="gmc-toolbar"><label className="gmc-search"><Search size={18}/><input aria-label="ค้นหามอนสเตอร์" placeholder="ชื่อ / หมายเลข / สกิล" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button type="button" aria-label="ล้างคำค้น" title="ล้างคำค้น" onClick={()=>setQuery('')}><X size={17}/></button>}</label><select aria-label="ธาตุมอนสเตอร์" value={element} onChange={event=>setElement(event.target.value)}><option value="all">ทุกธาตุ</option>{Object.entries(monsterElements).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select><select aria-label="ระดับดาว" value={stars} onChange={event=>setStars(event.target.value)}><option value="all">ทุกระดับดาว</option>{[1,2,3,4,5].map(count=><option value={count} key={count}>{count} ดาว</option>)}</select><select aria-label="เรียงมอนสเตอร์" value={sort} onChange={event=>setSort(event.target.value)}><option value="number">หมายเลข</option><option value="attack">พลังโจมตี</option><option value="support">พลังสนับสนุน</option><option value="stars">ระดับดาว</option></select></div>
   <div className="gmc-results"><span>{filtered.length} / {gameMonsters.length} ตัว</span><span>ดาว: ระดับพลังเบื้องต้น · ความหายากยังไม่กำหนด</span></div>
   <div className="gmc-grid" ref={grid}>{filtered.map(card=><button type="button" key={card.cardNo} data-monster={card.cardNo} className="gmc-card" aria-label={`ดูมอนสเตอร์ ${card.cardNo} ${card.name}`} onClick={()=>{lastCard.current=card.cardNo;setSelected(card)}}><div className="gmc-card-image"><img src={monsterThumbnail(card)} alt={card.name} loading="lazy" decoding="async"/><span>#{card.cardNo}</span></div><div className="gmc-card-meta"><Stars count={describeMonster(card).stars}/><strong>{card.name}</strong><span>{monsterElements[card.element]}<span><Swords size={12}/>{card.attack.toLocaleString()}</span></span></div></button>)}{!filtered.length&&<div className="gmc-empty"><Skull size={36}/><h2>ไม่พบมอนสเตอร์</h2><button onClick={()=>{setQuery('');setElement('all');setStars('all')}}>ล้างตัวกรอง</button></div>}</div>
  </>:<article className="gmc-character" key={selected.cardNo} data-element={selected.element}>
   <div className="gmc-character-stage"><span className="gmc-character-code">#{selected.cardNo}</span><MonsterArtwork card={selected}/></div>
   <div className="gmc-character-info"><span className="gmc-eyebrow">MONSTER / {monsterElements[selected.element]}</span><Stars count={details!.stars}/><h2>{selected.name}</h2><div className="gmc-rarity"><span>ความหายาก</span><strong>{details!.rarity||'รอจัดระดับ'}</strong></div><p className="gmc-power-note">{details!.stars} ดาว · ระดับพลังเบื้องต้น ไม่ใช่อัตราดรอป</p><dl className="gmc-stats"><div><dt><Swords size={16}/>ATTACK</dt><dd>{selected.attack.toLocaleString()}</dd></div><div><dt><Shield size={16}/>SUPPORT</dt><dd>{selected.support.toLocaleString()}</dd></div><div><dt>ธาตุ</dt><dd>{monsterElements[selected.element]}</dd></div></dl><section><h3>ทักษะประจำการ์ด</h3><p>{selected.skillText||'ไม่มีข้อความทักษะในฐานข้อมูลการ์ด'}</p></section><section><h3>บันทึกเรื่องราว</h3><p>{details!.lore||'ยังไม่มีบันทึกเนื้อเรื่องอย่างเป็นทางการ'}</p></section></div>
   <footer className="gmc-character-nav"><button type="button" aria-label="มอนสเตอร์ก่อนหน้า" title="มอนสเตอร์ก่อนหน้า" onClick={()=>next(-1)}><ArrowLeft/></button><span>{index+1} / {filtered.length}</span><button type="button" aria-label="มอนสเตอร์ถัดไป" title="มอนสเตอร์ถัดไป" onClick={()=>next(1)}><ArrowRight/></button><button className="gmc-return" type="button" onClick={back}>มอนสเตอร์ทั้งหมด</button></footer>
  </article>}
 </section>,document.body);
}
