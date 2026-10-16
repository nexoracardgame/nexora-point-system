"use client";

import {useState} from 'react';
import {Layers3,Users} from 'lucide-react';
import {playGameUiSound} from '@/lib/game-ui-audio';

export default function GameLobbyNavigation(_props:{onRank:()=>void;onHome:()=>void}){
 const [pending,setPending]=useState('');
 const soon=(label:string)=>{playGameUiSound();setPending(label)};
 return <nav className="nexora-command-nav" aria-label="เมนูเกม">
  <button type="button" title="การ์ดของฉัน · เมนูเกมกำลังเตรียม" onClick={()=>soon('การ์ดของฉัน')}><Layers3/>การ์ดของฉัน</button>
  <button type="button" title="เพื่อน · เมนูเกมกำลังเตรียม" onClick={()=>soon('เพื่อน')}><Users/>เพื่อน</button>
  {pending&&<span role="status" className="nexora-game-menu-pending">{pending} · ยังไม่เปิดให้บริการ</span>}
 </nav>;
}
