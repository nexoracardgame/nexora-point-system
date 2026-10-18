"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import GameWebsite from './GameWebsite';
import './WebGameLogin.css';
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
  const pathname=usePathname();
  const [desktop,setDesktop]=useState(false);
  useEffect(()=>{setDesktop(Boolean((window as typeof window&{nexoraDesktop?:{isGameDesktop?:boolean}}).nexoraDesktop?.isGameDesktop))},[]);
  if(!desktop)return pathname==='/game/login'?<div className="nexora-web-login">{children}</div>:<GameWebsite>{['/game/topup','/game/account','/game/verify-email'].includes(pathname)||pathname.startsWith('/game/world/')?children:null}</GameWebsite>;
  return <InstalledGameShell>{children}</InstalledGameShell>;
}

function InstalledGameShell({ children }: { children: React.ReactNode }) {
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
