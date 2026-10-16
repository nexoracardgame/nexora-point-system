"use client";

import {useState} from 'react';
import {House,Layers3,Trophy,Users} from 'lucide-react';
import {playGameUiSound} from '@/lib/game-ui-audio';

export default function GameLobbyNavigation({onRank,onHome}:{onRank:()=>void;onHome:()=>void}){
 const [pending,setPending]=useState('');
 const soon=(label:string)=>{playGameUiSound();setPending(label)};
 return <nav className="nexora-command-nav" aria-label="เมนูเกม">
  <button type="button" title="การ์ดของฉัน · เมนูเกมกำลังเตรียม" onClick={()=>soon('การ์ดของฉัน')}><Layers3/>การ์ดของฉัน</button>
  <button type="button" title="เพื่อน · เมนูเกมกำลังเตรียม" onClick={()=>soon('เพื่อน')}><Users/>เพื่อน</button>
  <button type="button" onClick={()=>{setPending('');onRank()}}><Trophy/>อันดับนักดวล</button>
  <button type="button" onClick={()=>{setPending('');playGameUiSound('back');onHome()}}><House/>หน้าหลักเกม</button>
  {pending&&<span role="status" className="nexora-game-menu-pending">{pending} · ยังไม่เปิดให้บริการ</span>}
 </nav>;
}
