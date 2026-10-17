"use client";
import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import GameCoinShop from './GameCoinShop';
import './GameCoinPreview.css';
export default function GameCoinPreview({onClose}:{onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>previous?.focus()},[]);
 return <dialog ref={dialog} className="game-coin-preview" aria-label="เติม COIN" onCancel={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose()}}><div className="game-coin-preview-body"><button className="game-coin-preview-close" title="ปิด" aria-label="ปิด" onClick={onClose}><X/></button><GameCoinShop preview/></div></dialog>;
}
