"use client";

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { LogOut, Minus, Maximize2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useBattleArenaActive } from '@/lib/battle-ui-state';
import {setGameWindowMode} from '@/lib/game-window-mode';
import './GameWindowControls.css';

type WindowBridge={isGameDesktop?:boolean;windowControl?:(action:'minimize'|'resize'|'close')=>Promise<boolean>};
export default function GameWindowControls(){
  const toolbar=useRef<HTMLDivElement>(null);
  const [desktop,setDesktop]=useState<WindowBridge|null>(null);
  const [leaving,setLeaving]=useState(false);
  const [menu,setMenu]=useState<Element|null>(null);
  const [confirmClose,setConfirmClose]=useState(false),[fullscreen,setFullscreen]=useState(false);
  useEffect(()=>{if(!confirmClose)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();setConfirmClose(false)}if(e.key==='Tab'){e.stopImmediatePropagation();const buttons=document.querySelectorAll<HTMLButtonElement>('.nexora-window-exit button'),first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true)},[confirmClose]);
  useEffect(()=>{const sync=()=>setFullscreen(document.fullscreenElement!==null||document.documentElement.dataset.gameWindowMode==='fullscreen');sync();window.addEventListener('nexora:window-mode',sync);document.addEventListener('fullscreenchange',sync);return()=>{window.removeEventListener('nexora:window-mode',sync);document.removeEventListener('fullscreenchange',sync)}},[]);
  const {status}=useSession();const pathname=usePathname();const active=useBattleArenaActive();
  useEffect(()=>{const bridge=(window as typeof window&{nexoraDesktop?:WindowBridge}).nexoraDesktop;if(bridge?.isGameDesktop&&bridge.windowControl)setDesktop(bridge)},[]);
  const lobby=status==='authenticated'&&!active&&(pathname==='/game'||pathname==='/game/pentad');
  useEffect(()=>{document.documentElement.dataset.gameWindowControls=desktop?'desktop':'';return()=>{delete document.documentElement.dataset.gameWindowControls}},[desktop]);
  useEffect(()=>{const node=toolbar.current;if(!node)return;const sync=()=>document.documentElement.style.setProperty('--game-window-controls-width',`${node.getBoundingClientRect().width}px`);sync();const observer=new ResizeObserver(sync);observer.observe(node);return()=>{observer.disconnect();document.documentElement.style.removeProperty('--game-window-controls-width')}},[desktop]);
  useEffect(()=>{
    if(!lobby){setMenu(null);return;}
    const sync=()=>setMenu(document.querySelector('.nexora-command-nav'));
    sync();const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[lobby]);
  const logout=async()=>{setLeaving(true);try{await signOut({callbackUrl:'/game/login'})}catch{setLeaving(false)}};
  const control=async(action:'minimize'|'resize')=>{try{if(fullscreen){await setGameWindowMode('windowed');if(action==='resize')return}await desktop?.windowControl?.(action)}catch{}};
  if(!desktop&&!lobby)return null;
  return <>
    {lobby&&menu&&createPortal(<button type="button" className="nexora-menu-logout" title="ออกจากระบบ" aria-label="ออกจากระบบ" disabled={leaving} onClick={()=>void logout()}><LogOut size={18}/><span>ออกจากระบบ</span></button>,menu)}
    {desktop&&!fullscreen&&<div className="nexora-window-drag" aria-hidden="true"/>}
    {confirmClose&&createPortal(<div className="nexora-settings-backdrop nexora-window-exit"><section className="nexora-settings-dialog" role="dialog" aria-modal="true" aria-label="ออกจากเกม"><h2>ต้องการออกจากเกมหรือไม่?</h2><div className="nexora-exit-actions"><button autoFocus onClick={()=>setConfirmClose(false)}>ยกเลิก</button><button onClick={()=>{setConfirmClose(false);void desktop?.windowControl?.('close')}}>ยืนยัน</button></div></section></div>,document.body)}
    {desktop&&createPortal(<div ref={toolbar} className="nexora-window-controls" role="toolbar" aria-label="ตัวควบคุมเกม" data-fullscreen={fullscreen}>
    <div data-game-utilities-slot />
    {!fullscreen&&<><button type="button" title="ย่อหน้าต่าง" aria-label="ย่อหน้าต่าง" onClick={()=>void control('minimize')}><Minus size={18}/></button><button type="button" title="สลับขนาดหน้าต่าง" aria-label="สลับขนาดหน้าต่าง" onClick={()=>void control('resize')}><Maximize2 size={17}/></button></>}<button type="button" className="nexora-window-close" title="ปิดเกม" aria-label="ปิดเกม" onClick={()=>setConfirmClose(true)}><X size={19}/></button>
    </div>,document.body)}
  </>;
}
