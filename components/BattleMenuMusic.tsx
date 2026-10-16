"use client";
import {useEffect} from 'react';
import {gameVolume} from '@/lib/game-settings';
export default function BattleMenuMusic(){
 useEffect(()=>{
  const music=new Audio('/audio/music/nexora-menu.mp3');music.loop=true;music.preload='auto';
  const sync=()=>{music.volume=.12*gameVolume('music');music.muted=music.volume===0;if(music.muted||document.hidden||document.documentElement.dataset.nexoraCombatActive==='true')music.pause();else void music.play().catch(()=>{})};
  sync();const events=['nexora:audio-preference','nexora:combat-activity','storage'];events.forEach(event=>window.addEventListener(event,sync));document.addEventListener('visibilitychange',sync);document.addEventListener('pointerdown',sync);document.addEventListener('keydown',sync);
  return()=>{music.pause();music.removeAttribute('src');music.load();events.forEach(event=>window.removeEventListener(event,sync));document.removeEventListener('visibilitychange',sync);document.removeEventListener('pointerdown',sync);document.removeEventListener('keydown',sync)};
 },[]);
 return null;
}
