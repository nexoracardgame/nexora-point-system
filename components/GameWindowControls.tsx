"use client";

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { LogOut, Minus, Maximize2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useBattleArenaActive } from '@/lib/battle-ui-state';
import './GameWindowControls.css';

type WindowBridge={isGameDesktop?:boolean;windowControl?:(action:'minimize'|'resize'|'close')=>Promise<boolean>};
export default function GameWindowControls(){
  const [desktop,setDesktop]=useState<WindowBridge|null>(null);
  const [leaving,setLeaving]=useState(false);
  const [menu,setMenu]=useState<Element|null>(null);
  const {status}=useSession();const pathname=usePathname();const active=useBattleArenaActive();
  useEffect(()=>{const bridge=(window as typeof window&{nexoraDesktop?:WindowBridge}).nexoraDesktop;if(bridge?.isGameDesktop&&bridge.windowControl)setDesktop(bridge)},[]);
  const lobby=status==='authenticated'&&!active&&(pathname==='/game'||pathname==='/game/pentad');
  useEffect(()=>{document.documentElement.dataset.gameWindowControls=desktop?'desktop':'';return()=>{delete document.documentElement.dataset.gameWindowControls}},[desktop]);
  useEffect(()=>{
    if(!lobby){setMenu(null);return;}
    const sync=()=>setMenu(document.querySelector('.nexora-command-nav'));
    sync();const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[lobby]);
  const logout=async()=>{setLeaving(true);try{await signOut({callbackUrl:'/game/login'})}catch{setLeaving(false)}};
  if(!desktop&&!lobby)return null;
  return <>
    {lobby&&menu&&createPortal(<button type="button" className="nexora-menu-logout" title="ออกจากระบบ" aria-label="ออกจากระบบ" disabled={leaving} onClick={()=>void logout()}><LogOut size={18}/><span>ออกจากระบบ</span></button>,menu)}
    {desktop&&<div className="nexora-window-controls" role="toolbar" aria-label="ตัวควบคุมเกม">
    {desktop&&<><button type="button" title="ย่อหน้าต่าง" aria-label="ย่อหน้าต่าง" onClick={()=>void desktop.windowControl?.('minimize')}><Minus size={18}/></button><button type="button" title="สลับขนาดหน้าต่าง" aria-label="สลับขนาดหน้าต่าง" onClick={()=>void desktop.windowControl?.('resize')}><Maximize2 size={17}/></button><button type="button" className="nexora-window-close" title="ปิดเกม" aria-label="ปิดเกม" onClick={()=>void desktop.windowControl?.('close')}><X size={19}/></button></>}
    </div>}
  </>;
}
