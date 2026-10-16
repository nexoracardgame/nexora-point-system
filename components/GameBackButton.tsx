"use client";

import { useRouter } from "next/navigation";
import { useBattleArenaActive } from "@/lib/battle-ui-state";
import { playGameUiSound } from "@/lib/game-ui-audio";

export default function GameBackButton() {
  const router = useRouter();
  const active = useBattleArenaActive();
  if (active) return null;
  const back = () => {
    playGameUiSound("back");
    const event = new Event("nexora:navigate-back", { cancelable: true });
    if (!window.dispatchEvent(event)) return;
    if (window.history.length > 1) router.back();
    else router.replace("/game");
  };
  return <button type="button" className="nexora-game-back" aria-label="ย้อนกลับ" title="ย้อนกลับ" onClick={back}>
    <img src="/images/lobby-play/back-button.png" alt="" width={1774} height={887} draggable={false} />
  </button>;
}
