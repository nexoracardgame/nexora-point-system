"use client";
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {preload} from 'react-dom';
import {LOBBY_ACTION_ART,loadLobbyAssets} from '@/lib/lobby-assets';
import {isGameRoute} from '@/lib/game-routes';

// Warm shared artwork without imposing a timed screen on ready game views.
export function beginBattleLoading(_trigger:'intent'|'arrival'='intent'){
 if(typeof window!=='undefined')void loadLobbyAssets().catch(()=>{});
}
export function useBattleLoadingStage(stage:string){
 useEffect(()=>{beginBattleLoading('arrival')},[stage]);
}
export default function BattleLoadingScreen(){
 const pathname=usePathname();
 preload(LOBBY_ACTION_ART,{as:'image',fetchPriority:'high'});
 if(isGameRoute(pathname))for(const name of ['arena','duelist-gold','duelist-silver','plate-gold','plate-silver','footer'])preload(`/images/versus/${name}.png`,{as:'image'});
 useEffect(()=>{beginBattleLoading('arrival')},[pathname]);
 return null;
}
