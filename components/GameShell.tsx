"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
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
import GameProfileOverlay from './GameProfileOverlay';
import GameDesktopUpdate from './GameDesktopUpdate';

const FloatingChatDock = dynamic(() => import("@/components/FloatingChatDock"), { ssr: false });

export default function GameShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router=useRouter();
  useEffect(()=>{if(pathname!=='/game'&&pathname!=='/game/login')router.prefetch('/game')},[pathname,router]);
  const active = useBattleArenaActive();
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return <OnlinePresenceProvider>
    <div className="nexora-game-platform" data-game-platform>
      <GameWindowControls />
      <GameDesktopUpdate />
      <GameBackButton />
      <GameSettings />
      <GameRoomResume />
      <GamePatchGate><div className={pathname === "/game/pentad" ? "nexora-pentad-shell" : "nexora-battle-shell"}>{children}</div></GamePatchGate>
      {pathname === "/game" && !active && <FloatingChatDock />}
      <GameProfileOverlay/>
    </div>
  </OnlinePresenceProvider>;
}
