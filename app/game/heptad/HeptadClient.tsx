"use client";

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Search, X } from 'lucide-react';
import type { HeptadRoom, HeptadRound } from '@/lib/heptad-room-store';
import { completeHeptadMatchDeck, emptyHeptadDeck, HEPTAD_RULES, HEPTAD_TURNS, validateHeptadMatchDeck, type HeptadBoard, type HeptadDeck } from '@/lib/heptad-rules';
import { triadCardByNo, triadCards, type TriadTurnResult } from '@/lib/triad-dominion';
import { pentadElementNames, type PentadSide } from '@/lib/pentad-dominion';
import { rateMonster } from '@/lib/game-monster-rating';
import { battleArenaForSeed } from '@/lib/triad-arena';
import { useBattleArenaActivity, useBattleCombatActivity } from '@/lib/battle-ui-state';
import { useCardGesture } from '@/lib/use-card-gesture';
import { sendBattleRoomExit } from '@/lib/battle-room-exit';
import {returnToBattleLobby} from '@/lib/battle-lobby-navigation';
import { confirmBattleLeave, confirmBattleSurrender } from '@/lib/battle-surrender-dialog';
import { getBrowserSupabaseClient } from '@/lib/supabase-browser';
import { BATTLE_CHAT_CHANGED } from '@/lib/battle-chat-messages';
import BattleElementBoosts from '@/components/BattleElementBoosts';
import HeptadWaitingRoom from '@/components/HeptadWaitingRoom';
import HeptadArenaBoard from '@/components/HeptadArenaBoard';
import { BattleArenaHeader, BattleArenaStatus, BattleArenaHand, type ArenaCardFilter } from '@/components/BattleArenaControls';
import { BattleArenaSurface, BattleArenaCardFrame, BattleArenaScoreplate } from '@/components/BattleArenaHud';
import { DeckPreparationHeader, DeckPreparationLayout, DeckPreparationTools } from '@/components/DeckPreparation';
import BattleCardInspector from '@/components/BattleCardInspector';
import BattleMatchResult from '@/components/BattleMatchResult';
import BattleVersusIntro from '@/components/BattleVersusIntro';
import TargetSelectionModal from '@/components/TargetSelectionModal';
import type { TargetOptionView } from '@/lib/target-selection-view';
import BattleArenaChat, { BattleArenaChatFrame } from '@/components/BattleArenaChat';
import BattleCinematic from '@/app/(main)/battle/triad-dominion/BattleCinematic';
import ElementClash from '@/app/(main)/battle/pentad-dominion/PentadElementClash';
import './HeptadClient.css';

const TITLE='HEPTAD · 7 ใบ';
const labels:Record<keyof HeptadDeck,string>={monsters:'มอนสเตอร์บนมือ',skills:'สกิลบนมือ',special:'เสริมพิเศษ',skillReserve:'กองสกิลเสริม',monsterReserve:'กองมอนสเตอร์เสริม'};
const blank=()=>Array.from({length:3},emptyHeptadDeck);
const time=(ms:number)=>{const n=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};

function Card({no,onChoose,onPreview,onPreviewEnd,disabled=false}:{no:string;onChoose?:()=>void;onPreview:(no:string)=>void;onPreviewEnd:()=>void;disabled?:boolean}){
  const card=triadCardByNo.get(no);const gesture=useCardGesture({onChoose,disabled,onPreview:()=>onPreview(no),onPreviewEnd});
  return card?<button {...gesture} type="button" className="heptad-hand-card" aria-label={card.name} aria-disabled={disabled}><BattleArenaCardFrame><img src={card.sourceImage} alt={card.name} draggable={false}/></BattleArenaCardFrame></button>:null;
}
export default function HeptadClient({userId,initialCode,spectate,initialRoom,onExitToLobby}:{userId:string;initialCode:string;spectate:boolean;initialRoom?:HeptadRoom;onExitToLobby?:()=>void}){
  const router=useRouter(),[room,setRoom]=useState<HeptadRoom|null>(initialRoom||null),ref=useRef(room);ref.current=room;
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),busyRef=useRef(false),pendingActions=useRef(new Set<string>()),generation=useRef(0),exited=useRef(false),leaving=useRef(false);
  const [now,setNow]=useState(Date.now()),[draft,setDraft]=useState<HeptadDeck[]>(blank),[fight,setFight]=useState(0),[group,setGroup]=useState<keyof HeptadDeck>('monsters'),[query,setQuery]=useState(''),[preview,setPreview]=useState(''),[filter,setFilter]=useState<ArenaCardFilter>('all');
  const [password,setPassword]=useState(''),[message,setMessage]=useState(''),[target,setTarget]=useState(''),[presentation,setPresentation]=useState<{round:HeptadRound;seats:HeptadRoom['lobby']['seats']}|null>(null),[elementDone,setElementDone]=useState(0),[history,setHistory]=useState(false),[pendingPick,setPendingPick]=useState<{epoch:number;cardNo:string}|null>(null);
  const seen=useRef(new Set<number>()),mounted=useRef(false);
  const side:PentadSide|undefined=room?.lobby.seats.host?.id===userId?'host':room?.lobby.seats.challenger?.id===userId?'challenger':undefined;
  const controller=room?.lobby.ownerId===userId;
  const arena=battleArenaForSeed(`heptad:${room?.code||initialCode}`);
  useBattleArenaActivity(Boolean(room));useBattleCombatActivity(Boolean(room&&!['waiting','deck'].includes(room.phase)));
  const accept=(next:HeptadRoom)=>{
    if(exited.current||ref.current&&ref.current.version>next.version)return;
    const round=next.rounds.at(-1),key=`heptad:scene:${next.code}:${next.createdAt}:${round?.id}`;
    if(next.phase==='result'&&round&&!seen.current.has(round.id)){
      seen.current.add(round.id);let shown=false;try{shown=sessionStorage.getItem(key)==='1';sessionStorage.setItem(key,'1');}catch{}
      if(!shown){setPresentation({round,seats:next.lobby.seats});setElementDone(0);}
    }
    ref.current=next;setRoom(next);setNow(Date.now());try{localStorage.setItem(`nexora:heptad:room:${userId}`,next.code);}catch{}
    setPendingPick(current=>current&&current.epoch===next.epoch&&next.phase==='select'?current:null);
  };
  const load=async(code:string)=>{
    if(exited.current)return;const current=generation.current;
    try{const response=await fetch(`/api/heptad-rooms?room=${code}`,{cache:'no-store',signal:AbortSignal.timeout(12000)}),data=await response.json();if(current!==generation.current)return;
      if(!response.ok)throw Error(data.error||'โหลดห้องไม่สำเร็จ');if(data.room)accept(data.room);
    }catch(err){if(current===generation.current&&!exited.current)setError(err instanceof Error?err.message:'เชื่อมต่อไม่สำเร็จ');}
  };
  const act=async(action:string,extra:Record<string,unknown>={},background=false)=>{
    if(exited.current||!background&&pendingActions.current.has(action))return false;if(!background){pendingActions.current.add(action);busyRef.current=true;setBusy(true);setError('');}
    const current=generation.current;
    try{const response=await fetch('/api/heptad-rooms',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(12000),body:JSON.stringify({action,code:ref.current?.code||initialCode,epoch:ref.current?.epoch,...extra})}),data=await response.json();
      if(current!==generation.current||exited.current)return false;if(!response.ok)throw Error(data.error||'คำสั่งไม่สำเร็จ');if(data.room)accept(data.room);return true;
    }catch(err){if(current===generation.current&&!exited.current){setError(err instanceof Error?err.message:'เชื่อมต่อไม่สำเร็จ');if(ref.current)void load(ref.current.code);}return false;}
    finally{if(!background){pendingActions.current.delete(action);busyRef.current=pendingActions.current.size>0;setBusy(busyRef.current);}}
  };
  useLayoutEffect(()=>{
    if(mounted.current)return;mounted.current=true;router.prefetch('/game');
    const code=initialCode||new URLSearchParams(location.search).get('room')||'';
    let transferred:HeptadRoom|null=ref.current;try{const saved=JSON.parse(sessionStorage.getItem('nexora:heptad:handoff')||'null');if(saved?.userId===userId&&saved.room?.code===code&&Date.now()-saved.at>=0&&Date.now()-saved.at<60000)transferred=saved.room;}catch{}
    if(transferred){accept(transferred);void load(transferred.code);}else if(/^\d{6}$/.test(code))void act('join',{code,spectate});else setError('ไม่พบหมายเลขห้อง กรุณาเข้าห้องจากหน้า PLAY');
  },[]);
  useEffect(()=>{const clock=setInterval(()=>setNow(Date.now()),200);return()=>clearInterval(clock);},[]);
  useLayoutEffect(()=>{
    if(room?.phase!=='special')return;
    const scene=document.querySelector<HTMLElement>('.heptad-scene');if(!scene)return;
    const frames=[...scene.querySelectorAll<HTMLElement>('.nexora-arena-scoreplate')];
    const fit=()=>{const top=scene.getBoundingClientRect().top;scene.style.setProperty('--special-safe-top',`${Math.max(0,...frames.map(frame=>frame.getBoundingClientRect().bottom-top))+12}px`);};
    const observer=new ResizeObserver(fit);frames.forEach(frame=>observer.observe(frame));observer.observe(scene);fit();
    window.addEventListener('resize',fit);return()=>{observer.disconnect();window.removeEventListener('resize',fit);scene.style.removeProperty('--special-safe-top');};
  },[room?.phase]);
  useEffect(()=>{
    if(!room)return;let stopped=false,timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{if(stopped||exited.current)return;await load(room.code);if(!stopped)timer=setTimeout(poll,document.hidden?5000:1000);};timer=setTimeout(poll,1000);
    const client=getBrowserSupabaseClient(),channel=client?.channel(`heptad:${room.code}`).on('broadcast',{event:'changed'},({payload})=>{if(payload?.action==='chat')window.dispatchEvent(new CustomEvent(BATTLE_CHAT_CHANGED,{detail:{mode:'heptad',code:room.code}}));else void load(room.code);}).subscribe();
    return()=>{stopped=true;clearTimeout(timer);if(client&&channel)void client.removeChannel(channel);};
  },[room?.code]);
  useEffect(()=>{if(room?.phase!=='deck'||!side)return;let saved;try{saved=JSON.parse(localStorage.getItem(`heptad:draft:${room.code}:${room.createdAt}:${userId}`)||'null');}catch{}
    setDraft(saved&&!validateHeptadMatchDeck(saved,room.tier,true).length?saved:structuredClone(room.decks[side]));
  },[room?.code,room?.phase,side]);
  const changeDeck=(value:HeptadDeck[])=>{if(!room||!side||room.ready[side])return;const errors=validateHeptadMatchDeck(value,room.tier,true);if(errors.length){setError(errors[0]);return;}setDraft(value);try{localStorage.setItem(`heptad:draft:${room.code}:${room.createdAt}:${userId}`,JSON.stringify(value));}catch{}};
  const leave=async()=>{if(leaving.current)return;leaving.current=true;
    try{const current=ref.current;if(side&&current&&!['waiting','finished'].includes(current.phase)&&!await confirmBattleLeave())return;
      exited.current=true;generation.current++;setPresentation(null);setRoom(null);ref.current=null;
      try{localStorage.removeItem(`nexora:heptad:room:${userId}`);sessionStorage.removeItem('nexora:heptad:handoff');}catch{}
      returnToBattleLobby(router,onExitToLobby);
      if(current)void sendBattleRoomExit('/api/heptad-rooms',{code:current.code});
    }finally{leaving.current=false;}
  };
  const pending=room?.choices.find(choice=>!choice.value);
  const pick=async(no:string)=>{if(!room||!side||room.picks[side]||pendingPick)return;setPendingPick({epoch:room.epoch,cardNo:no});setPreview('');const ok=await act('pick',{cardNo:no},true);if(!ok)setPendingPick(null);};
  useEffect(()=>setTarget(''),[room?.epoch,pending?.cardNo,pending?.copied]);
  const card=triadCardByNo.get(preview),currentRound=room?.rounds.at(-1),remaining=(player:PentadSide)=>{
    if(!room)return [];if(room.finalDuel)return room.finalPool[player];const pile=HEPTAD_TURNS[room.turn-1].kind==='monster'?room.decks[player]?.[room.fight-1]?.monsters:room.decks[player]?.[room.fight-1]?.skills;
    const values=[...(pile||[])];for(const no of room.used[player][room.fight-1]){const i=values.indexOf(no);if(i>=0)values.splice(i,1);}return values;
  };
  const options:TargetOptionView[]=(pending?.options||[]).map(id=>{
    const player=id.startsWith('player-')&&!id.includes('>')?'host':id.startsWith('bot-')&&!id.includes('>')?'challenger':undefined;
    const slot=id.endsWith('secondary')?(room&&room.turn<=4?2:5):1;
    const no=id.startsWith('copy:')?id.slice(5):player?room?.board[player][slot]||'':'';
    const c=triadCardByNo.get(no);
    if(id.includes('>')){const describe=(part:string)=>{const player=part.startsWith('player-')?'host':'challenger';const slot=part.endsWith('secondary')?(room&&room.turn<=4?2:5):1;return `${room?.lobby.seats[player]?.name||player} · ${triadCardByNo.get(room?.board[player][slot]||'')?.name||''}`;};const [first,second]=id.split('>');return {id,faction:'ally',label:`${describe(first)} -2,000 → ${describe(second)} +2,000`,action:true};}
    return {id,faction:player&&player!==side?'enemy':'ally',label:c?.name||({'draw-skill':'จั่วสกิลเสริม','reroll-own':'เปลี่ยนมอนสเตอร์เรา','reroll-opponent':'เปลี่ยนมอนสเตอร์คู่แข่ง','player-top>bot-top':'เรา → คู่แข่ง','bot-top>player-top':'คู่แข่ง → เรา'}[id]||id),card:c,action:!c};
  });
  const finishScene=()=>{const id=presentation?.round.id;setPresentation(null);if(id&&side)void act('complete',{roundId:id},true);};
  let cinematic:TriadTurnResult|undefined;
  if(presentation){const r=presentation.round;cinematic={turn:r.turn===1?1:r.turn<=4?2:3,prioritySide:'player',metric:r.turn===1?'total':r.turn<=4?'attack':'support',playerTotal:r.totals.host,opponentTotal:r.totals.challenger,winner:r.winner==='draw'?'draw':r.winner==='host'?'player':'opponent',effectivePlayer:{top:r.effective.host,left:'',right:''},effectiveOpponent:{top:r.effective.challenger,left:'',right:''},playerBreakdown:[],opponentBreakdown:[],unresolvedSkills:[],skillEvents:r.events};}
  const chat=room?<BattleArenaChat messages={room.lobby.chat.map(item=>({id:item.id,senderId:item.id.slice(0,item.id.lastIndexOf(':')),senderName:item.name,text:item.text,createdAt:item.at}))} currentUserId={userId} currentUserName={[room.lobby.seats.host,room.lobby.seats.challenger,...room.lobby.spectators].find(person=>person?.id===userId)?.name} room={{mode:'heptad',code:room.code}} draft={message} onDraftChange={setMessage} onSubmit={async()=>{const text=message;if(!text.trim())return false;setMessage('');const ok=await act('chat',{text},true);if(!ok)setMessage(current=>current||text);return ok;}}/>:null;
  if(cinematic&&presentation&&!presentation.round.finalDuel&&presentation.round.turn>1){
    const branch=presentation.round.turn<=4?2:5;
    cinematic.cinematicSupport={player:presentation.round.board.host[branch],opponent:presentation.round.board.challenger[branch]};
  }
  if(cinematic&&presentation){
    const r=presentation.round;
    const before=(side:PentadSide)=>[r.board[side][1],r.turn>1?r.board[side][r.turn<=4?2:5]:''].reduce((sum,no)=>{const card=triadCardByNo.get(no||'');return sum+(card?(r.turn===1?card.attack+card.support:r.turn<=4?card.attack:card.support):0)},0);
    cinematic.powerBefore={player:before('host'),opponent:before('challenger')};
    cinematic.elementalBoost={player:r.casts.find(c=>c.kind==='boost'&&c.side==='host')?.cardNo,opponent:r.casts.find(c=>c.kind==='boost'&&c.side==='challenger')?.cardNo};
  }
  const boosts=room?Object.fromEntries((['host','challenger'] as const).map(side=>[side,room.casts.find(c=>c.kind==='boost'&&c.side===side)?.cardNo||[...room.rounds].reverse().find(r=>r.fight===room.fight&&r.casts.some(c=>c.kind==='boost'&&c.side===side))?.casts.find(c=>c.kind==='boost'&&c.side===side)?.cardNo||''])):{};
  return <BattleArenaSurface className="heptad-scene" image={arena.image} data-heptad-phase={room?.phase||'entering'}>
    {room&&!presentation&&!['waiting','deck'].includes(room.phase)&&<BattleElementBoosts mode="heptad" boosts={boosts} used={Object.fromEntries((['host','challenger'] as const).map(side=>[side,!room.casts.some(c=>c.kind==='boost'&&c.side===side)||room.phase==='result'||room.phase==='finished']))}/>}
    {room?.phase!=='waiting'&&(room?.phase==='deck'?<DeckPreparationHeader title={TITLE} time={time(room.deadline-now)} onExit={()=>void leave()}/>:<BattleArenaHeader title={TITLE} code={room?.code} time={room?time(room.deadline-now):''} onExit={()=>void leave()} onSurrender={side&&room?.phase!=='finished'?async()=>{if(await confirmBattleSurrender())void act('surrender');}:undefined}/>)}
    {error&&<div className="heptad-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="ปิดข้อความ"><X size={16}/></button></div>}
    {!room&&error.includes('รหัสผ่าน')&&<form className="heptad-password" onSubmit={event=>{event.preventDefault();void act('join',{password,spectate});}}><label>รหัสผ่านห้อง<input type="password" value={password} onChange={event=>setPassword(event.target.value)}/></label><button disabled={busy}>เข้าห้อง</button></form>}
    {room?.phase==='waiting'&&<HeptadWaitingRoom code={room.code} onExit={()=>void leave()} onStart={()=>act('start',{},true)} chat={chat} seats={room.lobby.seats} spectators={room.lobby.spectators} userId={userId} leaderId={room.lobby.ownerId||''} mode={room.tier} canChange={controller} onMode={tier=>act('mode',{tier},true)} onWatch={()=>act('watch',{},true)} onTake={seat=>act('seat',{seat},true)} onBot={(seat,enabled)=>act('bot',{seat,enabled},true)}/>}
    {room?.phase==='deck'&&<DeckPreparationLayout tray={<><h2>จัดเด็ค 105 ใบ</h2>{side?<><div className="heptad-tabs">{[0,1,2].map(index=><button key={index} aria-pressed={fight===index} onClick={()=>setFight(index)}>ไฟต์ {index+1} · {Object.values(draft[index]).flat().length}/35</button>)}</div><div className="heptad-tabs">{(Object.keys(labels) as (keyof HeptadDeck)[]).map(key=><button key={key} aria-pressed={group===key} onClick={()=>setGroup(key)}>{labels[key]} {draft[fight][key].length}/{HEPTAD_RULES.deckSizes[key]}</button>)}</div><div className="heptad-chosen">{draft[fight][group].map((no,i)=><Card key={`${i}:${no}`} no={no} disabled={room.ready[side]||busy} onChoose={()=>changeDeck(draft.map((deck,index)=>index===fight?{...deck,[group]:deck[group].filter((_,j)=>j!==i)}:deck))} onPreview={setPreview} onPreviewEnd={()=>setPreview('')}/>)}</div></>:<p>ผู้เล่นกำลังจัดเด็ค</p>}<div className="heptad-ready">{(['host','challenger'] as const).map(player=><span key={player}>{room.lobby.seats[player]?.name} · {room.ready[player]?'พร้อม':'กำลังจัดเด็ค'}</span>)}</div></>}
      actions={side&&<><DeckPreparationTools disabled={busy||room.ready[side]} onClear={()=>changeDeck(blank())} onShuffle={()=>{try{changeDeck(completeHeptadMatchDeck(blank(),room.tier));}catch(err){setError(String(err));}}}/><button className="heptad-primary" disabled={busy||room.ready[side]||validateHeptadMatchDeck(draft,room.tier).length>0} onClick={()=>void act('ready',{decks:draft})}><Check size={18}/>{room.ready[side]?'พร้อมแล้ว':'ยืนยันเด็ค 105 ใบ'}</button></>}
      catalog={side&&<><label className="heptad-search"><Search size={16}/><input aria-label="ค้นหาการ์ด" placeholder="ค้นหาการ์ด" value={query} onChange={event=>setQuery(event.target.value)}/></label><div className="heptad-catalog">{triadCards.filter(c=>(c.kind===(group==='monsters'||group==='monsterReserve'?'monster':'skill'))&&(c.kind==='skill'||room.tier==='all'||rateMonster(c).tier===room.tier)&&`${c.cardNo} ${c.name} ${c.skillText}`.toLowerCase().includes(query.toLowerCase())).map(c=><Card key={c.cardNo} no={c.cardNo} disabled={busy||room.ready[side]||draft[fight][group].length>=HEPTAD_RULES.deckSizes[group]||c.kind==='skill'&&draft.some(deck=>[...deck.skills,...deck.special,...deck.skillReserve].includes(c.cardNo))} onChoose={()=>changeDeck(draft.map((deck,index)=>index===fight?{...deck,[group]:[...deck[group],c.cardNo]}:deck))} onPreview={setPreview} onPreviewEnd={()=>setPreview('')}/>)}</div></>}/>}
    {room&&!['waiting','deck'].includes(room.phase)&&<>
      <BattleArenaStatus fight={room.fight} turn={room.turn} turns={7} title={room.finalDuel?'ตัดสินมอนสเตอร์สุดท้าย':room.phase==='special'?'เรียกการ์ดเสริมพิเศษ':room.phase==='target'?'เลือกเป้าหมาย':room.phase==='result'?'ผลการปะทะ':'เลือกการ์ด'} hint={room.turn===1?'ธาตุปะทะ':room.turn<=4?'ATTACK':'SUPPORT'}/>
      {(['host','challenger'] as const).map(player=><BattleArenaScoreplate key={player} name={room.lobby.seats[player]?.name||'ผู้เล่น'} score={room.score[player]} player={player===(side||'host')} avatar={null} identity={{...room.lobby.seats[player],name:room.lobby.seats[player]?.name||'ผู้เล่น'}} currentUserId={userId}/>)}
      <div className="heptad-field" data-heptad-chat-arena><HeptadArenaBoard board={(['host','challenger'] as const).reduce((all,player)=>({...all,[player]:{...room.board[player],...(['select','special'].includes(room.phase)&&(room.picks[player]||player===side&&pendingPick?.epoch===room.epoch)?{[room.turn]:room.picks[player]==='__pass__'?'':room.picks[player]||(player===side?pendingPick?.cardNo||'':'')}:{})}}),{} as Record<PentadSide,HeptadBoard>)} names={{host:room.lobby.seats.host?.name||'ฝั่ง A',challenger:room.lobby.seats.challenger?.name||'ฝั่ง B'}} activeTurn={room.turn} playerSide={side}/></div>
      {side&&room.phase==='select'&&<BattleArenaHand title={HEPTAD_TURNS[room.turn-1].kind==='monster'?'เลือกมอนสเตอร์':'เลือกสกิล'} filter={filter} onFilterChange={setFilter}>{remaining(side).filter(no=>filter==='all'||triadCardByNo.get(no)?.kind===filter).map((no,i)=><Card key={`${no}:${i}`} no={no} disabled={busy||Boolean(room.picks[side]||pendingPick)||HEPTAD_TURNS[room.turn-1].kind==='skill'&&side!==room.opener&&!room.picks[room.opener]} onChoose={()=>void pick(no)} onPreview={setPreview} onPreviewEnd={()=>setPreview('')}/>)}</BattleArenaHand>}
      {room.phase==='special'&&<section className="heptad-special"><h2>การ์ดเสริมพิเศษ</h2>{room.specialOrder.length>0&&<p>{room.lobby.seats[room.specialOrder[0]]?.name} ประกาศเรียกก่อน · อีกฝ่ายเลือกเรียกหรือไม่เรียก</p>}{side&&!room.special[side]?<><span>ใช้แล้ว {room.specialUsed[side]}/{room.fight} ครั้ง</span><div className="heptad-special-cards">{room.decks[side][room.fight-1].special.filter(no=>!room.used[side][room.fight-1].includes(no)).map((_,slot)=><button key={slot} type="button" className="heptad-hand-card" disabled={busy} aria-label={`เปิดการ์ดเสริมใบที่ ${slot+1}`} onClick={()=>{setPreview('');void act('special',{slot});}}><BattleArenaCardFrame><img src="/cards/card-backs/card-backs.png" alt="การ์ดเสริมคว่ำหน้า" draggable={false}/></BattleArenaCardFrame></button>)}</div><button className="heptad-primary" disabled={busy} onClick={()=>void act('special',{cardNo:''})}>ไม่เรียกการ์ดเสริม</button></>:<p>รอทั้งสองฝ่ายยืนยัน · {time(room.deadline-now)}</p>}</section>}
      {room.phase==='result'&&currentRound&&!presentation&&<section className="heptad-round-summary"><strong>{currentRound.winner==='draw'?'เสมอ':`${room.lobby.seats[currentRound.winner]?.name} ชนะ`}</strong><span>{currentRound.totals.host.toLocaleString()} : {currentRound.totals.challenger.toLocaleString()}</span><span>{currentRound.reason}</span></section>}
      <button className="heptad-history-toggle" onClick={()=>setHistory(!history)} aria-expanded={history}>บันทึกสนาม</button>
      {history&&<aside className="heptad-history"><header>บันทึกสนาม<button aria-label="ปิดบันทึกสนาม" onClick={()=>setHistory(false)}><X size={18}/></button></header>{[...room.rounds].reverse().map(round=><details key={round.id}><summary>ไฟต์ {round.fight} · ตา {round.turn} · {round.winner==='draw'?'เสมอ':room.lobby.seats[round.winner]?.name}</summary><p>{round.reason} · {round.totals.host} : {round.totals.challenger}</p>{round.events.map((event,i)=><p key={i}>{event.summary}</p>)}</details>)}</aside>}
      {room.phase==='finished'&&<BattleMatchResult title={room.winner==='draw'?'เสมอ':`${room.lobby.seats[room.winner as PentadSide]?.name||room.lobby.forfeit?.winner.name||'ผู้เล่น'} ชนะ`} score={[room.score.host,room.score.challenger]} draw={room.winner==='draw'} detail={room.notice} onExit={leave}/>}
    </>}
    {room&&room.phase!=='waiting'&&<BattleArenaChatFrame arenaSelector="[data-heptad-chat-arena]" layoutKey={room.phase} cinematicActive={Boolean(presentation)} rotateBreakpoint={1000}>{chat}</BattleArenaChatFrame>}
    {card&&<BattleCardInspector card={card} element={`ธาตุ${pentadElementNames[card.element]}`} interactive={false} onClose={()=>setPreview('')}/>}
    {room?.phase==='target'&&pending&&!presentation&&<TargetSelectionModal key={`${room.epoch}:${pending.cardNo}:${pending.copied||''}`} contextKey={`${room.epoch}:${pending.cardNo}:${pending.copied||''}`} skillName={triadCardByNo.get(pending.copied||pending.cardNo)?.name||pending.cardNo} description={triadCardByNo.get(pending.copied||pending.cardNo)?.skillText||''} options={options} selected={target?[target]:[]} timeLeft={Math.max(0,Math.ceil((room.deadline-now)/1000))} readOnly={side!==pending.side} waitingText={`รอ ${room.lobby.seats[pending.side]?.name} เลือกเป้าหมาย`} busy={busy} onSelect={ids=>setTarget(ids[0]||'')} onConfirm={()=>act('target',{target})}/>}
    {room&&<BattleVersusIntro sessionKey={`heptad:${room.code}:${room.createdAt}`} enabled={room.phase==='select'&&room.fight===1&&room.turn===1} left={room.lobby.seats.host||{name:'ฝ่าย A'}} right={room.lobby.seats.challenger||{name:'ฝ่าย B'}} background={arena.image}/>}
    {presentation&&cinematic&&(presentation.round.elementClash&&elementDone!==presentation.round.id?<ElementClash round={{id:presentation.round.id,fight:presentation.round.fight,turn:1,finalDuel:false,mains:{host:presentation.round.board.host[presentation.round.turn]||'',challenger:presentation.round.board.challenger[presentation.round.turn]||''}}} room={{seats:presentation.seats}} arenaImage={arena.image} comparisonLabel={presentation.round.turn===1?'ATK + SUP':presentation.round.turn<=4?'ATK หลัก + รอง':'SUP หลัก + รอง'} onComplete={()=>{if(presentation.round.reason==='ธาตุพิชิต')finishScene();else setElementDone(presentation.round.id);}}/>:<BattleCinematic key={presentation.round.id} result={cinematic} cardsByNo={triadCardByNo} playerCard={triadCardByNo.get(presentation.round.casts.find(cast=>cast.side==='host')?.cardNo||presentation.round.board.host[presentation.round.turn]||'')} opponentCard={triadCardByNo.get(presentation.round.casts.find(cast=>cast.side==='challenger')?.cardNo||presentation.round.board.challenger[presentation.round.turn]||'')} playerMainCard={triadCardByNo.get(presentation.round.board.host[1]||'')} opponentMainCard={triadCardByNo.get(presentation.round.board.challenger[1]||'')} playerName={presentation.seats.host?.name||'ฝ่าย A'} opponentName={presentation.seats.challenger?.name||'ฝ่าย B'} arena={arena} landscape onComplete={finishScene}/>) }
  </BattleArenaSurface>;
}
