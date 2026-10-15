"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Trophy } from "lucide-react";
import type { BattleForfeit } from "@/lib/battle-forfeit";
import { playGameUiSound } from "@/lib/game-ui-audio";
import "./BattleSurrenderDialog.css";

export default function BattleForfeitVictory({ result, userId, onExit }: { result?: BattleForfeit; userId: string; onExit: () => void }) {
  const exit = useRef(onExit); exit.current = onExit;
  const won = result?.winner.id === userId;
  useEffect(() => {
    if (!won) return;
    playGameUiSound("confirm");
    const timer = setTimeout(() => exit.current(), 2800);
    return () => clearTimeout(timer);
  }, [won, result?.at]);
  if (!won) return null;
  return createPortal(<div className="nexora-surrender-backdrop"><section className="nexora-surrender-dialog" role="status" aria-live="assertive" style={{textAlign:"center"}}><Trophy size={44} color="#f2d58c" style={{margin:"0 auto"}} /><h2 style={{color:"#f2d58c"}}>คุณชนะ!</h2><p>คู่ต่อสู้ออกจากสนาม<br />กำลังกลับหน้าหลัก</p></section></div>, document.body);
}
