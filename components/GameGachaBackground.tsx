"use client";
import {useEffect,useRef,useState} from 'react';
import {loadLoginWallpaper} from '@/lib/login-wallpaper';
import GameEntryBackground from './GameEntryBackground';

export default function GameGachaBackground({shared=false,homeLoop=false}:{shared?:boolean;homeLoop?:boolean}){
 return homeLoop||shared?<GameEntryBackground scene="shop" className="gg-background gg-shop-background"/>:<LegacyGachaBackground/>;
}

function LegacyGachaBackground(){
 const [url,setUrl]=useState(''),[ready,setReady]=useState(false);
 const video=useRef<HTMLVideoElement>(null);
 useEffect(()=>{let active=true,objectUrl='';const controller=new AbortController();
  void loadLoginWallpaper(controller.signal).then(value=>{if(!active){URL.revokeObjectURL(value);return}objectUrl=value;setUrl(value)}).catch(()=>{});
  return()=>{active=false;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl)};
 },[]);
 useEffect(()=>{const sync=()=>{const element=video.current;if(!element)return;let motionOff=false;try{motionOff=localStorage.getItem('triad-command-motion-off')==='1'}catch{}if(document.hidden||motionOff||window.matchMedia('(prefers-reduced-motion: reduce)').matches)element.pause();else void element.play().catch(()=>{})};const preference=window.matchMedia('(prefers-reduced-motion: reduce)');sync();document.addEventListener('visibilitychange',sync);window.addEventListener('nexora:motion-preference',sync);preference.addEventListener('change',sync);return()=>{document.removeEventListener('visibilitychange',sync);window.removeEventListener('nexora:motion-preference',sync);preference.removeEventListener('change',sync)}},[url]);
 return <div className="gg-background" aria-hidden="true">{url&&<video ref={video} src={url} autoPlay muted loop playsInline onLoadedData={()=>setReady(true)} onError={()=>setReady(false)} style={{opacity:ready?1:0}}/>}</div>;
}
