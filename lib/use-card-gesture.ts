"use client";
import {useEffect,useRef,type MouseEvent,type PointerEvent} from 'react';
export function useCardGesture({onChoose,onPreview,onPreviewEnd,disabled=false}:{onChoose?:()=>void;onPreview:()=>void;onPreviewEnd:()=>void;disabled?:boolean}){
 const hold=useRef<ReturnType<typeof setTimeout>|null>(null),held=useRef(false),lastTap=useRef(0),origin=useRef({x:0,y:0});
 const cancel=()=>{if(hold.current)clearTimeout(hold.current);hold.current=null};
 useEffect(()=>()=>cancel(),[]);
 const release=()=>{cancel();if(held.current)onPreviewEnd()};
 return {
  onClick:(event:MouseEvent<HTMLButtonElement>)=>{event.stopPropagation();if(held.current){held.current=false;lastTap.current=0;return}if(disabled||!onChoose)return;const now=Date.now();if(event.detail===0||lastTap.current>0&&now-lastTap.current<=450){lastTap.current=0;onPreviewEnd();onChoose()}else lastTap.current=now},
  onPointerDown:(event:PointerEvent<HTMLButtonElement>)=>{if(event.button!==0)return;try{event.currentTarget.setPointerCapture?.(event.pointerId)}catch{}cancel();held.current=false;origin.current={x:event.clientX,y:event.clientY};hold.current=setTimeout(()=>{held.current=true;lastTap.current=0;onPreview()},event.pointerType==='mouse'?250:2500)},
  onPointerMove:(event:PointerEvent<HTMLButtonElement>)=>{if(event.pointerType!=='mouse'&&Math.hypot(event.clientX-origin.current.x,event.clientY-origin.current.y)>10)release()},
  onPointerUp:release,onPointerCancel:()=>{release();lastTap.current=0},onPointerLeave:()=>{release();onPreviewEnd()},
  onContextMenu:(event:MouseEvent<HTMLButtonElement>)=>event.preventDefault(),
  onTouchEnd:()=>{},draggable:false,
  onMouseEnter:()=>{},onPointerEnter:()=>{},onFocus:()=>{},onBlur:()=>{release();onPreviewEnd()},
 };
}
