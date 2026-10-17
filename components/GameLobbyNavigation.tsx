"use client";

import {useCallback,useEffect,useState} from 'react';
import {useSession} from 'next-auth/react';
import {loadGameFriends,prepareGameFriends} from '@/lib/game-friends-client';
import {Layers3,Users,Trophy,Swords,Skull} from 'lucide-react';
import {playGameUiSound} from '@/lib/game-ui-audio';
import GameFriendsPanel from './GameFriendsPanel';
import GameCardCollection from './GameCardCollection';
import GameMonsterCodex from './GameMonsterCodex';

export default function GameLobbyNavigation({onRank,onJoin}:{onRank:()=>void;onHome:()=>void;onJoin:()=>void}){
 const {data:session}=useSession(),owner=session?.user?.id;
 useEffect(()=>{if(!owner)return;void prepareGameFriends(owner).catch(()=>{});const refresh=()=>{void loadGameFriends(owner,true).then(()=>prepareGameFriends(owner)).catch(()=>{})};const timer=setInterval(()=>{if(!document.hidden)refresh()},60000);window.addEventListener('nexora:friends-updated',refresh);return()=>{clearInterval(timer);window.removeEventListener('nexora:friends-updated',refresh)}},[owner]);
 const [friendsOpen,setFriendsOpen]=useState(false);
 const closeFriends=useCallback(()=>setFriendsOpen(false),[]);
 return <nav className="nexora-command-nav" aria-label="เมนูเกม">
  <button type="button" title="การ์ดของฉัน" onClick={()=>{playGameUiSound();window.dispatchEvent(new Event('nexora:open-game-collection'));}}><Layers3/>การ์ดของฉัน</button>
  <button type="button" title="มอนสเตอร์" onClick={()=>{playGameUiSound();window.dispatchEvent(new Event('nexora:open-monsters'))}}><Skull/>มอนสเตอร์</button>
  <button type="button" title="เพื่อน" onClick={()=>{playGameUiSound();setFriendsOpen(true);}}><Users/>เพื่อน</button>
  <button type="button" onClick={()=>{playGameUiSound();onRank()}}><Trophy/>อันดับแรงค์</button>
  <button type="button" onClick={onJoin}><Swords/>เข้าร่วม/ชมการต่อสู้</button>
  {friendsOpen&&<GameFriendsPanel onClose={closeFriends}/>}
  <GameCardCollection/>
  <GameMonsterCodex/>
 </nav>;
}
