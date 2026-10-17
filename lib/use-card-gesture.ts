"use client";
import {useEffect,useRef,type MouseEvent,type PointerEvent} from 'react';
let mousePreview:{owner:object;end:()=>void}|null=null;
let mouseSubscribers=0;
const endMousePreview=()=>{const current=mousePreview;mousePreview=null;current?.end()};
export function useCardGesture({onChoose,onPreview,onPreviewEnd,disabled=false}:{onChoose?:()=>void;onPreview:()=>void;onPreviewEnd:()=>void;disabled?:boolean}){
 const owner=useRef({});
 const hold=useRef<ReturnType<typeof setTimeout>|null>(null),held=useRef(false),lastTap=useRef(0),origin=useRef({x:0,y:0});
 const cancel=()=>{if(hold.current)clearTimeout(hold.current);hold.current=null};
 const release=()=>{cancel();if(held.current)onPreviewEnd()};
 useEffect(()=>{if(mouseSubscribers++===0){window.addEventListener('pointerup',endMousePreview);window.addEventListener('pointercancel',endMousePreview);window.addEventListener('blur',endMousePreview)}return()=>{cancel();if(mousePreview?.owner===owner.current)endMousePreview();if(--mouseSubscribers===0){window.removeEventListener('pointerup',endMousePreview);window.removeEventListener('pointercancel',endMousePreview);window.removeEventListener('blur',endMousePreview)}}},[]);
 const inspectMouse=()=>{if(mousePreview?.owner!==owner.current)endMousePreview();mousePreview={owner:owner.current,end:release};cancel();held.current=true;lastTap.current=0;onPreview()};
 return {
  onClick:(event:MouseEvent<HTMLButtonElement>)=>{event.stopPropagation();if(held.current){held.current=false;lastTap.current=0;return}if(disabled||!onChoose)return;const now=Date.now();if(event.detail===0||lastTap.current>0&&now-lastTap.current<=450){lastTap.current=0;onPreviewEnd();onChoose()}else lastTap.current=now},
  onPointerDown:(event:PointerEvent<HTMLButtonElement>)=>{if(event.button!==0)return;if(event.pointerType==='mouse')event.preventDefault();else try{event.currentTarget.setPointerCapture?.(event.pointerId)}catch{}cancel();held.current=false;origin.current={x:event.clientX,y:event.clientY};if(event.pointerType==='mouse'){endMousePreview();mousePreview={owner:owner.current,end:release}}hold.current=setTimeout(()=>{if(event.pointerType==='mouse')inspectMouse();else{held.current=true;lastTap.current=0;onPreview()}},event.pointerType==='mouse'?250:2500)},
  onPointerMove:(event:PointerEvent<HTMLButtonElement>)=>{if(event.pointerType==='mouse'){if((event.buttons&1)&&!held.current)inspectMouse()}else if(Math.hypot(event.clientX-origin.current.x,event.clientY-origin.current.y)>10)release()},
  onPointerUp:release,onPointerCancel:()=>{release();lastTap.current=0},onPointerLeave:()=>{release();onPreviewEnd()},
  onContextMenu:(event:MouseEvent<HTMLButtonElement>)=>event.preventDefault(),
  onTouchEnd:()=>{},draggable:false,onDragStartCapture:(event:MouseEvent<HTMLButtonElement>)=>event.preventDefault(),
  onMouseEnter:()=>{},onPointerEnter:(event:PointerEvent<HTMLButtonElement>)=>{if(event.pointerType==='mouse'&&(event.buttons&1))inspectMouse()},onFocus:()=>{},onBlur:()=>{release();onPreviewEnd()},
 };
}
