"use client";
import {playGameUiSound} from '@/lib/game-ui-audio';

export default function GameBackControl({onBack}:{onBack:()=>void}){
 return <button type="button" className="nexora-game-back" aria-label="ย้อนกลับ" title="ย้อนกลับ" onClick={()=>{playGameUiSound('back');onBack()}}><img src="/images/lobby-play/back-button.png" alt="" width={1774} height={887} draggable={false}/></button>;
}
