"use client";

import { usePathname, useRouter } from "next/navigation";
import { useBattleArenaActive } from "@/lib/battle-ui-state";
import GameBackControl from './GameBackControl';

export default function GameBackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const active = useBattleArenaActive();
  if (active || pathname === "/game" || pathname === "/game/login") return null;
  const back = () => {
    const event = new Event("nexora:navigate-back", { cancelable: true });
    if (!window.dispatchEvent(event)) return;
    if (window.history.length > 1) router.back();
    else router.replace("/game");
  };
  return <GameBackControl onBack={back}/>;
}
