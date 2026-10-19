"use client";
import {Eye,Crown,Check,Bot,LogIn,UserMinus} from 'lucide-react';
import './BattleWaitingRoom.css';
type Person={id:string;name:string;image?:string};
type Mode={id:string;title:string;description:string};
export default function BattleWaitingRoom({seats,spectators,userId,leaderId,modes,mode,canChange,busy,onMode,onWatch,onTake,onBot,children}:{seats:{host:Person|null;challenger:Person|null};spectators:Person[];userId:string;leaderId:string;modes:Mode[];mode:string;canChange:boolean;busy?:boolean;onMode:(id:string)=>void;onWatch:()=>void;onTake:(side:'host'|'challenger')=>void;onBot?:(side:'host'|'challenger',enabled:boolean)=>void;children?:React.ReactNode}){
 const seated=seats.host?.id===userId||seats.challenger?.id===userId;
 return <section className="nexora-shared-waiting"><div className="nsw-seats">{(['host','challenger'] as const).map(side=>{
  const person=seats[side],bot=person?.id==='triad-bot-level-99'||person?.id==='pentad-bot';
  return <article key={side} className="nsw-seat" aria-label={side==='host'?'ฝั่ง A':'ฝั่ง B'}><small>{side==='host'?'ฝั่ง A':'ฝั่ง B'}</small><div className="nsw-person">
   {person?<><div className="nsw-avatar"><img src={person.image||'/avatar.png'} alt=""/>{person.id===leaderId&&<Crown/>}</div><strong>{person.name}</strong><span>{bot?'BOT · พร้อมลงสนาม':'พร้อมลงสนาม'}</span></>:<strong>รอผู้เล่น</strong>}
   <div className="nsw-seat-actions">
    {!person&&!seated&&<button onClick={()=>onTake(side)} disabled={busy}><LogIn size={16}/>ลงสนาม</button>}
    {onBot&&canChange&&(!person||bot)&&<button onClick={()=>onBot(side,!bot)} disabled={busy} aria-label={`${bot?'เอาบอทออก':'เพิ่มบอทลงสนาม'} ${side==='host'?'ฝั่ง A':'ฝั่ง B'}`}>{bot?<UserMinus size={16}/>:<Bot size={16}/>} {bot?'เอาบอทออก':'เพิ่มบอทลงสนาม'}</button>}
   </div>
  </div></article>;
 })}<b className="nsw-vs">VS</b></div><section className="nsw-settings" aria-label="กติกาห้อง"><small>โหมดห้อง</small><strong>{modes.find(item=>item.id===mode)?.title}</strong><div className="nsw-modes">{modes.map(item=><button key={item.id} aria-pressed={item.id===mode} disabled={!canChange||busy} onClick={()=>onMode(item.id)}><span>{item.title}{item.id===mode&&<Check size={15}/>}</span><small>{item.description}</small></button>)}</div>{seated&&<button className="nsw-watch" disabled={busy} onClick={onWatch}><Eye size={16}/>ไปนั่งชม</button>}</section><div className="nsw-spectators"><span><Eye size={14}/> ผู้ชม {spectators.length}/10</span>{Array.from({length:10},(_,i)=><span className="nsw-spectator" key={i} title={spectators[i]?.name}>{spectators[i]?<img src={spectators[i].image||'/avatar.png'} alt={spectators[i].name}/>:i+1}</span>)}{!seated&&<span>คุณกำลังนั่งชม</span>}</div>{children}</section>;
}
