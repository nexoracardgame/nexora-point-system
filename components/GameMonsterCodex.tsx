"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,ArrowRight,Diamond,Search,Shield,Skull,Star,Swords,X} from 'lucide-react';
import {gameMonsters,describeMonster,monsterElements,monsterThumbnail,warmMonsterImages,monsterTiers,monsterStarBands} from '@/lib/game-monsters';
import type {TriadCard} from '@/lib/triad-dominion';
import GameBackControl from './GameBackControl';
import GamePageLogo from './GamePageLogo';
import GameEntryBackground from './GameEntryBackground';
import './GameMonsterCodex.css';

function Stars({count}:{count:number}){return <span className="gmc-stars" aria-label={`ระดับพลัง ${count} ดาว`}>{[1,2,3,4,5].map(value=><Star key={value} size={14} fill={value<=count?'currentColor':'none'} data-filled={value<=count}/>)}</span>}
function MonsterArtwork({card}:{card:TriadCard}){
 const [ready,setReady]=useState(false);const artwork=describeMonster(card).characterArt||card.sourceImage;
 return <div className="gmc-character-art" data-card-art={!describeMonster(card).characterArt}><div className="gmc-art-surface"><img className="gmc-character-preview" src={monsterThumbnail(card)} alt=""/><img className="gmc-character-full" src={artwork} alt={card.name} decoding="async" onLoad={()=>setReady(true)} onError={()=>setReady(false)} style={{opacity:ready?1:0}}/></div><span className="gmc-art-sparks" aria-hidden="true"/></div>;
}
export default function GameMonsterCodex(){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[element,setElement]=useState('all'),[stars,setStars]=useState('all'),[sort,setSort]=useState('number'),[selected,setSelected]=useState<TriadCard|null>(null);
 const [tier,setTier]=useState('all');
 const root=useRef<HTMLElement>(null),grid=useRef<HTMLDivElement>(null),trigger=useRef<HTMLElement|null>(null),lastCard=useRef<string|null>(null);
 const filtered=useMemo(()=>gameMonsters.filter(card=>(element==='all'||element===card.element)&&(tier==='all'||describeMonster(card).tier===tier)&&(stars==='all'||describeMonster(card).stars===Number(stars))&&(!query.trim()||[card.name,card.cardNo,card.skillText].some(value=>value.toLowerCase().includes(query.trim().toLowerCase())))).sort((a,b)=>sort==='power'?describeMonster(b).totalPower-describeMonster(a).totalPower:sort==='attack'?b.attack-a.attack:sort==='support'?b.support-a.support:sort==='stars'?describeMonster(b).stars-describeMonster(a).stars||describeMonster(b).totalPower-describeMonster(a).totalPower:Number(a.cardNo)-Number(b.cardNo)),[query,element,tier,stars,sort]);
 const close=useCallback(()=>{setOpen(false);setSelected(null);requestAnimationFrame(()=>trigger.current?.focus())},[]);
 const back=useCallback(()=>{if(selected){setSelected(null);requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(`[data-monster="${lastCard.current}"]`)?.focus())}else close()},[selected,close]);
 useEffect(()=>{const show=()=>{trigger.current=document.activeElement as HTMLElement;setQuery('');setElement('all');setStars('all');lastCard.current=gameMonsters[0]?.cardNo||null;setSelected(gameMonsters[0]||null);setOpen(true)};window.addEventListener('nexora:open-monsters',show);const cleanup=warmMonsterImages(gameMonsters);return()=>{window.removeEventListener('nexora:open-monsters',show);cleanup()}},[]);
 useEffect(()=>{if(open)root.current?.focus()},[open]);
 useEffect(()=>{if(!open)setTier('all')},[open]);
 useEffect(()=>{grid.current?.scrollTo({top:0})},[query,element,tier,stars,sort]);
 useEffect(()=>{root.current?.querySelector('.gmc-character')?.scrollTo({top:0});root.current?.querySelector('.gmc-character-info')?.scrollTo({top:0})},[selected]);
 const index=selected?filtered.findIndex(card=>card.cardNo===selected.cardNo):-1;
 const next=(direction:number)=>{if(!filtered.length)return;const card=filtered[(index+direction+filtered.length)%filtered.length];lastCard.current=card.cardNo;setSelected(card)};
 useEffect(()=>{if(!open||!selected)return;return warmMonsterImages([selected,filtered[(index+1)%filtered.length],filtered[(index-1+filtered.length)%filtered.length]].filter(Boolean),true)},[open,selected,index,filtered]);
 useEffect(()=>{
  if(!open)return;
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close()}
   const editing=event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement;
   if(!editing&&selected&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();next(event.key==='ArrowLeft'?-1:1)}
   if(event.key==='Tab'){const controls=[...root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,[tabindex="0"]')||[]].filter(node=>node.getClientRects().length);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){event.preventDefault();last?.focus()}else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===root.current)){event.preventDefault();first?.focus()}}
  };
  const navigateBack=(event:Event)=>{event.preventDefault();close()};document.addEventListener('keydown',key,true);window.addEventListener('nexora:navigate-back',navigateBack);return()=>{document.removeEventListener('keydown',key,true);window.removeEventListener('nexora:navigate-back',navigateBack)};
 },[open,selected,close,index,filtered]);
 if(!open)return null;
 const details=selected?describeMonster(selected):null;
 return createPortal(<section className="game-monster-codex" role="dialog" aria-modal="true" aria-label="สารานุกรมมอนสเตอร์" tabIndex={-1} ref={root}>
  <GameEntryBackground scene="monster" className="gg-background"/>
  <header className="gmc-header"><GameBackControl onBack={close}/><GamePageLogo/><div><h1>มอนสเตอร์</h1><span>NEXORA / MONSTER ARCHIVE</span></div><span className="gmc-count">{gameMonsters.length} ตัว</span></header>
  {!selected?<>
   <div className="gmc-toolbar"><label className="gmc-search"><Search size={18}/><input aria-label="ค้นหามอนสเตอร์" placeholder="ชื่อ / หมายเลข / สกิล" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button type="button" aria-label="ล้างคำค้น" title="ล้างคำค้น" onClick={()=>setQuery('')}><X size={17}/></button>}</label><select aria-label="ธาตุมอนสเตอร์" value={element} onChange={event=>setElement(event.target.value)}><option value="all">ทุกธาตุ</option>{Object.entries(monsterElements).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select><select aria-label="ระดับดาว" value={stars} onChange={event=>setStars(event.target.value)}><option value="all">ทุกระดับดาว</option>{[1,2,3,4,5].map(count=><option value={count} key={count}>{count} ดาว</option>)}</select><select aria-label="เรียงมอนสเตอร์" value={sort} onChange={event=>setSort(event.target.value)}><option value="number">หมายเลข</option><option value="attack">พลังโจมตี</option><option value="support">พลังสนับสนุน</option><option value="stars">ระดับดาว</option></select></div>
   <div className="gmc-results"><span>{filtered.length} / {gameMonsters.length} ตัว</span><select aria-label="ระดับหลักมอนสเตอร์" value={tier} onChange={event=>setTier(event.target.value)}><option value="all">ทุกระดับหลัก</option>{Object.entries(monsterTiers).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select><span>พลังรวม = ATK + SUP · ธาตุไม่ส่งผลต่อดาว</span></div>
   <div className="gmc-grid" ref={grid}>{filtered.map(card=>{const rating=describeMonster(card);return <button type="button" key={card.cardNo} data-monster={card.cardNo} data-tier={rating.tier} className="gmc-card" aria-label={`ดูมอนสเตอร์ ${card.cardNo} ${card.name}`} onClick={()=>{lastCard.current=card.cardNo;setSelected(card)}}><div className="gmc-card-image"><img src={monsterThumbnail(card)} alt={card.name} loading="lazy" decoding="async"/><span>#{card.cardNo}</span></div><div className="gmc-card-meta"><span className="gmc-tier-badge" data-tier={rating.tier}>{rating.rarity}</span><Stars count={rating.stars}/><strong>{card.name}</strong><span>{monsterElements[card.element]}<span title="ATK + SUP">รวม {rating.totalPower.toLocaleString()}</span></span></div></button>})}{!filtered.length&&<div className="gmc-empty"><Skull size={36}/><h2>ไม่พบมอนสเตอร์</h2><button onClick={()=>{setQuery('');setElement('all');setStars('all');setTier('all')}}>ล้างตัวกรอง</button></div>}</div>
  </>:<article className="gmc-character" data-element={selected.element}>
   <aside className="gmc-elements" aria-label="หมวดมอนสเตอร์">{[['all','ทั้งหมด'],...Object.entries(monsterElements)].filter(([id])=>id==='all'||gameMonsters.some(card=>card.element===id)).map(([id,label])=><button type="button" key={id} aria-pressed={element===id} onClick={()=>{setElement(id);setQuery('');setStars('all');setTier('all');const card=gameMonsters.find(card=>id==='all'||card.element===id);if(card){lastCard.current=card.cardNo;setSelected(card)}}}><Diamond size={14} aria-hidden="true"/>{label}</button>)}</aside>
   <div className="gmc-character-stage"><span className="gmc-character-code">#{selected.cardNo}</span><MonsterArtwork key={selected.cardNo} card={selected}/></div>
   <div className="gmc-character-info">
    <span className="gmc-eyebrow">MONSTER / {monsterElements[selected.element]}</span><Stars count={details!.stars}/><h2>{selected.name}</h2>
    <div className="gmc-rarity"><span>ระดับหลัก</span><strong className="gmc-tier-badge" data-tier={details!.tier}>{details!.rarity}</strong></div>
    <p className="gmc-power-note">{details!.stars} ดาว · พลังรวม {details!.totalPower.toLocaleString()} · ATK + SUP</p>
    <dl className="gmc-stats"><div><dt><Swords size={16}/>ATTACK</dt><dd>{selected.attack.toLocaleString()}</dd></div><div><dt><Shield size={16}/>SUPPORT</dt><dd>{selected.support.toLocaleString()}</dd></div><div><dt>พลังรวม</dt><dd>{details!.totalPower.toLocaleString()}</dd></div></dl>
    <section><h3>เกณฑ์ระดับดาว</h3><p>{monsterStarBands.map(band=>`${band.stars}★ ${band.max===null?'ตั้งแต่ '+band.min.toLocaleString():band.min===0?'ต่ำกว่า '+(band.max+1).toLocaleString():band.min.toLocaleString()+'–'+band.max.toLocaleString()}`).join(' · ')}</p><p>ดาวจัดจากพลังรวม ไม่ใช่เปอร์เซ็นต์ดรอปกาชา</p></section>
    <section><h3>ทักษะประจำการ์ด</h3><p>{selected.skillText||'ไม่มีข้อความทักษะในฐานข้อมูลการ์ด'}</p></section>
    <section><h3>บันทึกเรื่องราว</h3><p>{details!.lore||'ยังไม่มีบันทึกเนื้อเรื่องอย่างเป็นทางการ'}</p></section>
   </div>
   <footer className="gmc-character-nav"><button type="button" aria-label="มอนสเตอร์ก่อนหน้า" title="มอนสเตอร์ก่อนหน้า" onClick={()=>next(-1)}><ArrowLeft/></button><div className="gmc-roster" aria-label="เลือกมอนสเตอร์" ref={node=>{const active=node?.querySelector<HTMLElement>('[aria-pressed="true"]');if(node&&active)node.scrollLeft+=active.getBoundingClientRect().left-node.getBoundingClientRect().left-(node.clientWidth-active.clientWidth)/2}}>{filtered.map(card=><button type="button" key={card.cardNo} aria-label={`เลือก ${card.name}`} aria-pressed={selected.cardNo===card.cardNo} onClick={()=>{lastCard.current=card.cardNo;setSelected(card)}}><img src={monsterThumbnail(card)} alt="" loading="lazy" decoding="async"/><span>{card.name}</span></button>)}</div><button type="button" aria-label="มอนสเตอร์ถัดไป" title="มอนสเตอร์ถัดไป" onClick={()=>next(1)}><ArrowRight/></button><div className="gmc-roster-actions"><span>{index+1} / {filtered.length}</span><button className="gmc-return" type="button" onClick={back}>มอนสเตอร์ทั้งหมด</button></div></footer>
  </article>}
 </section>,document.body);
}
