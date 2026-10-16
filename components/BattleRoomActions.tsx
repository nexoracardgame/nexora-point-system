"use client";

import { Bot, Loader2, Swords } from "lucide-react";
import "./BattleRoomActions.css";

export default function BattleRoomActions({ onExit, onBot, onStart, botBusy = false, hasBot = false, botDisabled, startDisabled }: {
  onExit: () => void; onBot: () => void; onStart: () => void;
  botBusy?: boolean; hasBot?: boolean; botDisabled: boolean; startDisabled: boolean;
}) {
  return <div className="flex flex-wrap items-center justify-end gap-2" data-room-actions>
    <span data-game-audio-slot />
    <button type="button" onClick={onExit} className="inline-flex h-11 items-center justify-center rounded-xl border border-white/14 bg-black/45 px-4 text-xs font-black text-white/78 transition hover:border-white/30 hover:bg-black/55">ออกห้อง</button>
    <button type="button" onClick={onBot} disabled={botBusy || botDisabled} aria-busy={botBusy} aria-pressed={hasBot} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-black transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/8 disabled:text-white/28 ${hasBot ? "border-cyan-100/55 bg-cyan-200 text-black hover:bg-cyan-100" : "border-cyan-200/28 bg-cyan-300/10 text-cyan-50 hover:border-cyan-100/60 hover:bg-cyan-300/16"}`}>
      {botBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}{botBusy ? "กำลังอัปเดต" : hasBot ? "เอาบอทออก" : "สู้กับบอท"}
    </button>
    <button type="button" onClick={onStart} disabled={startDisabled} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 px-5 text-xs font-black text-black shadow-[0_0_32px_rgba(251,191,36,0.26)] transition hover:from-amber-200 hover:to-yellow-100 disabled:cursor-not-allowed disabled:text-black/35"><Swords className="h-4 w-4" />เริ่มเกม</button>
  </div>;
}
