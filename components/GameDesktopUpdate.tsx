"use client";
import {useEffect,useState} from 'react';
import {Download,RotateCw} from 'lucide-react';
import {useBattleArenaActive} from '@/lib/battle-ui-state';
import './GameDesktopUpdate.css';
import {isInstalledGameRuntime} from '@/lib/game-desktop-runtime';
type Update={status:string;detail?:{version?:string;percent?:number}};
type Bridge={isGameDesktop?:boolean;onUpdate:(callback:(event:Update)=>void)=>()=>void;checkForUpdates:()=>Promise<unknown>;installUpdate:()=>Promise<unknown>};
export default function GameDesktopUpdate(){
 const active=useBattleArenaActive(),[update,setUpdate]=useState<Update|null>(null),[busy,setBusy]=useState(false);
 useEffect(()=>{const bridge=(window as typeof window&{nexoraDesktop?:Bridge}).nexoraDesktop;if(!isInstalledGameRuntime(window)||!bridge?.onUpdate||!bridge.checkForUpdates)return;const stop=bridge.onUpdate(event=>{setUpdate(current=>current?.status==='downloaded'?current:event)});void bridge.checkForUpdates().catch(()=>{});return stop},[]);
 if(!update||!['available','downloading','downloaded'].includes(update.status)||active)return null;
 const ready=update.status==='downloaded';
 return <aside className="game-desktop-update" role="status"><Download size={18}/><span>{ready?'ตัวเกมรุ่นใหม่พร้อมติดตั้ง':'กำลังดาวน์โหลดตัวเกมรุ่นใหม่'}{update.detail?.version&&' · '+update.detail.version}{update.status==='downloading'&&' · '+Math.floor(update.detail?.percent||0)+'%'}</span>{ready&&<button disabled={busy} onClick={()=>{setBusy(true);const bridge=(window as typeof window&{nexoraDesktop?:Bridge}).nexoraDesktop;void bridge?.installUpdate().catch(()=>setBusy(false))}}><RotateCw size={16}/>อัปเดตและเริ่มใหม่</button>}</aside>;
}
