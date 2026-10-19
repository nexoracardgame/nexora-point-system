"use client";
import {Eye,Crown,Check,Bot,LogIn,UserMinus} from 'lucide-react';
import {useRef,useState} from 'react';
import './BattleWaitingRoom.css';
import GamePreparationBackground from './GamePreparationBackground';
type Person={id:string;name:string;image?:string};
type Mode={id:string;title:string;description:string};
export default function BattleWaitingRoom({seats:confirmedSeats,spectators:confirmedSpectators,userId,leaderId,modes,mode:confirmedMode,canChange,busy:externalBusy,onMode,onWatch,onTake,onBot,children,botId='triad-bot-level-99'}:{seats:{host:Person|null;challenger:Person|null};spectators:Person[];userId:string;leaderId:string;modes:Mode[];mode:string;canChange:boolean;busy?:boolean;onMode:(id:string)=>void|Promise<unknown>;onWatch:()=>void|Promise<unknown>;onTake:(side:'host'|'challenger')=>void|Promise<unknown>;onBot?:(side:'host'|'challenger',enabled:boolean)=>void|Promise<unknown>;children?:React.ReactNode;botId?:string}){
 const [pending,setPending]=useState<{seats:typeof confirmedSeats;spectators:Person[];mode:string}|null>(null);
 const locked=useRef(false);
 const seats=pending?.seats||confirmedSeats,spectators=pending?.spectators||confirmedSpectators,mode=pending?.mode||confirmedMode,busy=externalBusy||Boolean(pending);
 const execute=async(update:NonNullable<typeof pending>,run:()=>void|Promise<unknown>)=>{
  if(locked.current||externalBusy)return;
  locked.current=true;setPending(update);
  try{await run()}catch{/* The owning room controller reports request failures. */}finally{locked.current=false;setPending(null)}
 };
 const snapshot={seats:{...seats},spectators:[...spectators],mode};
 const take=(side:'host'|'challenger')=>{const self=spectators.find(person=>person.id===userId);void execute(self?{...snapshot,seats:{...seats,[side]:self},spectators:spectators.filter(person=>person.id!==userId)}:snapshot,()=>onTake(side))};
 const watch=()=>{const self=[seats.host,seats.challenger].find(person=>person?.id===userId);if(!self)return;void execute({...snapshot,seats:{host:seats.host?.id===userId?null:seats.host,challenger:seats.challenger?.id===userId?null:seats.challenger},spectators:[...spectators,self]},onWatch)};
 const seated=seats.host?.id===userId||seats.challenger?.id===userId;
 return <section className="nexora-shared-waiting"><GamePreparationBackground/><div className="nsw-seats">{(['host','challenger'] as const).map(side=>{
  const person=seats[side],bot=person?.id==='triad-bot-level-99'||person?.id==='pentad-bot';
  return <article key={side} className="nsw-seat" aria-label={side==='host'?'ฝั่ง A':'ฝั่ง B'}><small>{side==='host'?'ฝั่ง A':'ฝั่ง B'}</small><div className="nsw-person">
   {person?<><div className="nsw-avatar"><img src={person.image||'/avatar.png'} alt=""/>{person.id===leaderId&&<Crown/>}</div><strong>{person.name}</strong><span>{bot?'BOT · พร้อมลงสนาม':'พร้อมลงสนาม'}</span></>:<strong>รอผู้เล่น</strong>}
   <div className="nsw-seat-actions">
    {!person&&!seated&&<button onClick={()=>take(side)} disabled={busy}><LogIn size={16}/>ลงสนาม</button>}
    {onBot&&canChange&&(!person||bot)&&<button onClick={()=>onBot&&execute({...snapshot,seats:{...seats,[side]:!bot?{id:botId,name:`BOT Level.99 · ${side==='host'?'A':'B'}`,image:'/avatar.png'}:null}},()=>onBot(side,!bot))} disabled={busy} aria-label={`${bot?'เอาบอทออก':'เพิ่มบอทลงสนาม'} ${side==='host'?'ฝั่ง A':'ฝั่ง B'}`}>{bot?<UserMinus size={16}/>:<Bot size={16}/>} {bot?'เอาบอทออก':'เพิ่มบอทลงสนาม'}</button>}
   </div>
  </div></article>;
 })}<b className="nsw-vs">VS</b></div><section className="nsw-settings" aria-label="กติกาห้อง"><small>โหมดห้อง</small><strong>{modes.find(item=>item.id===mode)?.title}</strong><div className="nsw-modes">{modes.map(item=><button key={item.id} aria-pressed={item.id===mode} disabled={!canChange||busy} onClick={()=>void execute({...snapshot,mode:item.id},()=>onMode(item.id))}><span>{item.title}{item.id===mode&&<Check size={15}/>}</span><small>{item.description}</small></button>)}</div>{seated&&<button className="nsw-watch" disabled={busy} onClick={watch}><Eye size={16}/>ไปนั่งชม</button>}</section><div className="nsw-spectators"><span><Eye size={14}/> ผู้ชม {spectators.length}/10</span>{Array.from({length:10},(_,i)=><span className="nsw-spectator" key={i} title={spectators[i]?.name}>{spectators[i]?<img src={spectators[i].image||'/avatar.png'} alt={spectators[i].name}/>:i+1}</span>)}{!seated&&<span>คุณกำลังนั่งชม</span>}</div>{children}</section>;
}
