"use client";
import {useEffect,useRef,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {Fullscreen,RotateCw,Smartphone} from 'lucide-react';
import './GameLandscapeGuard.css';

const gameSelector='[data-game-platform],.nexora-battle-shell,.nexora-pentad-shell,.nexora-web-login';
function subscribe(notify:()=>void){
 const observer=new MutationObserver(notify);
 observer.observe(document.body,{childList:true,subtree:true});
 window.addEventListener('resize',notify);window.addEventListener('orientationchange',notify);
 return()=>{observer.disconnect();window.removeEventListener('resize',notify);window.removeEventListener('orientationchange',notify)};
}
const isPortraitGame=()=>Boolean(document.querySelector(gameSelector)&&window.innerHeight>window.innerWidth);
export default function GameLandscapeGuard(){
 const blocked=useSyncExternalStore(subscribe,isPortraitGame,()=>false),panel=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  if(!blocked)return;
  const previous=document.activeElement as HTMLElement|null;
  const dialog=panel.current;dialog?.showModal();
  panel.current?.querySelector('button')?.focus({preventScroll:true});
  const key=(event:KeyboardEvent)=>{if(!panel.current?.contains(event.target as Node)){event.preventDefault();event.stopImmediatePropagation();panel.current?.querySelector('button')?.focus({preventScroll:true})}else if(event.key==='Tab'){event.preventDefault();event.stopImmediatePropagation()}else if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation()}};
  window.addEventListener('keydown',key,true);
  return()=>{window.removeEventListener('keydown',key,true);dialog?.close();if(previous?.isConnected)previous.focus({preventScroll:true})};
 },[blocked]);
 const enter=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen?.({navigationUI:'hide'});const orientation=screen.orientation as ScreenOrientation&{lock?:(value:string)=>Promise<void>};await orientation.lock?.('landscape')}catch{/* Manual rotation remains available when the browser refuses orientation locking. */}};
 return blocked?createPortal(<dialog className="game-landscape-guard" ref={panel} onCancel={event=>event.preventDefault()} aria-modal="true" aria-label="เล่นเกมในแนวนอน"><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME"/><div className="glg-device" aria-hidden="true"><Smartphone/><RotateCw/></div><h1>หมุนหน้าจอเป็นแนวนอน</h1><button onClick={()=>void enter()}><Fullscreen/>เข้าโหมดแนวนอน</button></dialog>,document.body):null;
}
