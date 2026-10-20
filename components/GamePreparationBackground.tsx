"use client";
import {useLayoutEffect,useRef} from 'react';
import {PREPARATION_WALLPAPER_POSTER} from '@/lib/home-wallpaper';
import {attachPreparationVideo} from '@/lib/preparation-video';
import './GamePreparationBackground.css';
export default function GamePreparationBackground(){
 const holder=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>holder.current?attachPreparationVideo(holder.current):undefined,[]);
 return <div className="nexora-preparation-background" aria-hidden="true"><img src={PREPARATION_WALLPAPER_POSTER} alt="" decoding="async"/><div ref={holder} className="nexora-preparation-video-holder"/></div>;
}
