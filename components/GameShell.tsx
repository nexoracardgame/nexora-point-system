"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { OnlinePresenceProvider } from "@/components/OnlinePresenceProvider";
import { useBattleArenaActive } from "@/lib/battle-ui-state";
import "./BattleHud.css";
import "./GameShell.css";
import GamePatchGate from './GamePatchGate';
import GameWindowControls from './GameWindowControls';
import GameBackButton from './GameBackButton';
import GameSettings from './GameSettings';
import GameRoomResume from './GameRoomResume';

const FloatingChatDock = dynamic(() => import("@/components/FloatingChatDock"), { ssr: false });

export default function GameShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = useBattleArenaActive();
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return <OnlinePresenceProvider>
    <div className="nexora-game-platform" data-game-platform>
      <GameWindowControls />
      <GameBackButton />
      <GameSettings />
      <GameRoomResume />
      <GamePatchGate><div className={pathname === "/game/pentad" ? "nexora-pentad-shell" : "nexora-battle-shell"}>{children}</div></GamePatchGate>
      {pathname === "/game" && !active && <FloatingChatDock />}
    </div>
  </OnlinePresenceProvider>;
}
