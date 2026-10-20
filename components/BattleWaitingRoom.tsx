"use client";
import {Eye,Crown,Check,Bot,LogIn,UserMinus} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';
import {BattleCommandQueue} from '@/lib/battle-command-queue';
import BattleWaitingHeader from './BattleWaitingHeader';
import './BattleWaitingRoom.css';
import GamePreparationBackground from './GamePreparationBackground';
import BattlePlayerProfile from './BattlePlayerProfile';

type Person={id:string;name:string;image?:string};
type Mode={id:string;title:string;description:string};
type WaitingState={seats:{host:Person|null;challenger:Person|null};spectators:Person[];mode:string};
type Side='host'|'challenger';
type Result=void|Promise<unknown>;
export default function BattleWaitingRoom({seats:confirmedSeats,spectators:confirmedSpectators,userId,leaderId,modes,mode:confirmedMode,canChange,busy:externalBusy,onMode,onWatch,onTake,onBot,children,chat,code,onExit,onStart,botId='triad-bot-level-99'}:{seats:WaitingState['seats'];spectators:Person[];userId:string;leaderId:string;modes:Mode[];mode:string;canChange:boolean;busy?:boolean;onMode:(id:string)=>Result;onWatch:()=>Result;onTake:(side:Side)=>Result;onBot?:(side:Side,enabled:boolean)=>Result;children?:React.ReactNode;chat?:React.ReactNode;code?:string;onExit?:()=>void;onStart?:()=>Result;botId?:string}){
 const [pending,setPending]=useState<WaitingState|null>(null),[starting,setStarting]=useState(false);
 const pendingRef=useRef(pending),confirmed=useRef<WaitingState>({seats:confirmedSeats,spectators:confirmedSpectators,mode:confirmedMode});
 confirmed.current={seats:confirmedSeats,spectators:confirmedSpectators,mode:confirmedMode};
 const callbacks=useRef({onMode,onWatch,onTake,onBot,onStart,onExit});callbacks.current={onMode,onWatch,onTake,onBot,onStart,onExit};
 const queue=useRef(new BattleCommandQueue()),revision=useRef(0),alive=useRef(true),startingRef=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;revision.current++;queue.current.cancelPending();};},[]);
 const {seats,spectators,mode}=pending||confirmed.current;
 const execute=async(update:(state:WaitingState)=>WaitingState,run:()=>Result,key?:string)=>{
  const ticket=++revision.current;
  const next=update(pendingRef.current||confirmed.current);pendingRef.current=next;setPending(next);
  try{await queue.current.enqueue(run,key);}catch{/* The owning controller reports request failures. */}
  finally{if(alive.current&&revision.current===ticket){pendingRef.current=null;setPending(null);}}
 };
 const take=(side:Side)=>void execute(state=>{
  const self=state.spectators.find(person=>person.id===userId)||[state.seats.host,state.seats.challenger].find(person=>person?.id===userId);
  return self?{...state,seats:{host:state.seats.host?.id===userId?null:state.seats.host,challenger:state.seats.challenger?.id===userId?null:state.seats.challenger,[side]:self},spectators:state.spectators.filter(person=>person.id!==userId)}:state;
 },()=>callbacks.current.onTake(side));
 const watch=()=>void execute(state=>{
  const self=[state.seats.host,state.seats.challenger].find(person=>person?.id===userId);
  return self?{...state,seats:{host:state.seats.host?.id===userId?null:state.seats.host,challenger:state.seats.challenger?.id===userId?null:state.seats.challenger},spectators:[...state.spectators.filter(person=>person.id!==userId),self]}:state;
 },()=>callbacks.current.onWatch());
 const start=async()=>{
  if(startingRef.current)return;startingRef.current=true;setStarting(true);
  try{await execute(state=>state,()=>callbacks.current.onStart?.());}
  finally{startingRef.current=false;if(alive.current)setStarting(false);}
 };
 const exit=()=>{revision.current++;queue.current.cancelPending();callbacks.current.onExit?.();};
 const seated=seats.host?.id===userId||seats.challenger?.id===userId;
 const isBot=(person:Person|null)=>person?.id===botId||person?.id==='triad-bot-level-99'||person?.id==='pentad-bot';
 return <>{code&&onExit&&onStart&&<BattleWaitingHeader code={code} onExit={exit} onStart={()=>void start()} botBusy={false} botDisabled={!canChange} startDisabled={starting||!canChange||!seats.host||!seats.challenger}/>}
 <section className="nexora-shared-waiting" aria-busy={Boolean(pending)||externalBusy}><GamePreparationBackground/><div className="nsw-seats">{(['host','challenger'] as const).map(side=>{
  const person=seats[side],bot=isBot(person);
  return <article key={side} className="nsw-seat" aria-label={side==='host'?'ฝั่ง A':'ฝั่ง B'}><div className="nsw-person">
   {person?<><div className="nsw-framed-identity"><BattlePlayerProfile identity={person} player={side==='challenger'} currentUserId={userId} showRankBadge/>{person.id===leaderId&&<Crown className="nsw-leader" aria-label="หัวหน้าห้อง"/>}</div><span className="nsw-ready">{bot?'BOT · พร้อมลงสนาม':'พร้อมลงสนาม'}</span></>:<strong>รอผู้เล่น</strong>}
   <div className="nsw-seat-actions">
    {!person&&!seated&&<button onClick={()=>take(side)} disabled={starting}><LogIn size={16}/>ลงสนาม</button>}
    {onBot&&canChange&&(!person||bot)&&<button onClick={()=>void execute(state=>({...state,seats:{...state.seats,[side]:!bot?{id:botId,name:`BOT Level.99 · ${side==='host'?'A':'B'}`,image:'/avatar.png'}:null}}),()=>callbacks.current.onBot?.(side,!bot))} disabled={starting} aria-label={`${bot?'เอาบอทออก':'เพิ่มบอทลงสนาม'} ${side==='host'?'ฝั่ง A':'ฝั่ง B'}`}>{bot?<UserMinus size={16}/>:<Bot size={16}/>} {bot?'เอาบอทออก':'เพิ่มบอทลงสนาม'}</button>}
   </div>
  </div></article>;
 })}<b className="nsw-vs">VS</b>{chat&&<div className="nsw-chat-row"><div className="nsw-chat">{chat}</div></div>}</div>
 <section className="nsw-settings" aria-label="กติกาห้อง"><small>โหมดห้อง</small><strong>{modes.find(item=>item.id===mode)?.title}</strong><div className="nsw-modes">{modes.map(item=><button key={item.id} aria-pressed={item.id===mode} disabled={!canChange||starting} onClick={()=>void execute(state=>({...state,mode:item.id}),()=>callbacks.current.onMode(item.id),'mode')}><span>{item.title}{item.id===mode&&<Check size={15}/>}</span><small>{item.description}</small></button>)}</div>{seated&&<button className="nsw-watch" disabled={starting} onClick={watch}><Eye size={16}/>ไปนั่งชม</button>}</section>
 <div className="nsw-footer"><div className="nsw-spectators"><span><Eye size={14}/> ผู้ชม {spectators.length}/10</span>{Array.from({length:10},(_,i)=><span className="nsw-spectator" key={i} title={spectators[i]?.name}>{spectators[i]?<img src={spectators[i].image||'/avatar.png'} alt={spectators[i].name}/>:i+1}</span>)}{!seated&&<span>คุณกำลังนั่งชม</span>}</div></div>{children}</section></>;
}
