"use client";

import {useRef,useState} from 'react';
import {Clapperboard,Play,X} from 'lucide-react';
import {gameBattleTutorials} from '@/lib/game-battle-tutorials';
import './GameBattleTutorials.css';

export default function GameBattleTutorials(){
 const [selected,setSelected]=useState<(typeof gameBattleTutorials)[number]|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),video=useRef<HTMLVideoElement>(null);
 const [failed,setFailed]=useState(false);
 const close=()=>{video.current?.pause();dialog.current?.close();setSelected(null)};
 const open=(lesson:(typeof gameBattleTutorials)[number])=>{if(!lesson.video)return;setFailed(false);setSelected(lesson);dialog.current?.showModal()};
 return <section id="tutorials" className="nx-tutorials" aria-labelledby="nx-tutorials-title">
  <header><div><span className="nx-site-eyebrow">NEXORA / BATTLE ACADEMY</span><h2 id="nx-tutorials-title">บทสอนการต่อสู้</h2></div><span className="nx-tutorials-count">06 <span>LESSONS</span></span></header>
  <div className="nx-tutorial-grid">{gameBattleTutorials.map((lesson,index)=><article key={lesson.id} className="nx-tutorial" data-ready={Boolean(lesson.video)}>
   <img src={lesson.poster} alt="" loading="lazy" decoding="async"/>
   <span className="nx-tutorial-number">{String(index+1).padStart(2,'0')}</span>
   {lesson.video?<button className="nx-tutorial-play" title={`เล่นวิดีโอ ${lesson.title}`} aria-label={`เล่นวิดีโอ ${lesson.title}`} onClick={()=>open(lesson)}><Play size={25}/></button>:<span className="nx-tutorial-pending"><Clapperboard size={26}/><span>เร็ว ๆ นี้</span></span>}
   <div className="nx-tutorial-caption"><h3>{lesson.title}</h3><span>{lesson.video?'ชมบทสอน':'ยังไม่มีวิดีโอ'}</span></div>
  </article>)}</div>
  <dialog ref={dialog} className="nx-tutorial-dialog" aria-label={selected?.title||'วิดีโอบทสอนการต่อสู้'} onCancel={close} onClick={event=>{if(event.target===event.currentTarget)close()}}><div><header><h3>{selected?.title}</h3><button title="ปิดวิดีโอ" aria-label="ปิดวิดีโอ" onClick={close}><X size={23}/></button></header>{selected?.video&&<video ref={video} key={selected.id} src={selected.video} poster={selected.poster} controls autoPlay playsInline preload="metadata" onError={()=>setFailed(true)}/>} {failed&&<p role="alert">ไม่สามารถเปิดวิดีโอได้ กรุณาลองอีกครั้ง</p>}</div></dialog>
 </section>;
}
