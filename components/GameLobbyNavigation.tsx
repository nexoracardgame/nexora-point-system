"use client";

import {useCallback,useEffect,useState} from 'react';
import {useSession} from 'next-auth/react';
import {loadGameFriends,prepareGameFriends} from '@/lib/game-friends-client';
import {Layers3,Users,Trophy,Swords} from 'lucide-react';
import {playGameUiSound} from '@/lib/game-ui-audio';
import GameFriendsPanel from './GameFriendsPanel';

export default function GameLobbyNavigation({onRank,onJoin}:{onRank:()=>void;onHome:()=>void;onJoin:()=>void}){
 const {data:session}=useSession(),owner=session?.user?.id;
 useEffect(()=>{if(!owner)return;void prepareGameFriends(owner).catch(()=>{});const refresh=()=>{void loadGameFriends(owner,true).then(()=>prepareGameFriends(owner)).catch(()=>{})};const timer=setInterval(()=>{if(!document.hidden)refresh()},60000);window.addEventListener('nexora:friends-updated',refresh);return()=>{clearInterval(timer);window.removeEventListener('nexora:friends-updated',refresh)}},[owner]);
 const [pending,setPending]=useState('');
 const [friendsOpen,setFriendsOpen]=useState(false);
 const closeFriends=useCallback(()=>setFriendsOpen(false),[]);
 const soon=(label:string)=>{playGameUiSound();setPending(label)};
 return <nav className="nexora-command-nav" aria-label="เมนูเกม">
  <button type="button" title="การ์ดของฉัน · เมนูเกมกำลังเตรียม" onClick={()=>soon('การ์ดของฉัน')}><Layers3/>การ์ดของฉัน</button>
  <button type="button" title="เพื่อน" onClick={()=>{playGameUiSound();setFriendsOpen(true);}}><Users/>เพื่อน</button>
  <button type="button" onClick={()=>{setPending('');playGameUiSound();onRank()}}><Trophy/>อันดับแรงค์</button>
  <button type="button" onClick={()=>{setPending('');onJoin()}}><Swords/>เข้าร่วม/ชมการต่อสู้</button>
  {pending&&<span role="status" className="nexora-game-menu-pending">{pending} · ยังไม่เปิดให้บริการ</span>}
  {friendsOpen&&<GameFriendsPanel onClose={closeFriends}/>}
 </nav>;
}
