"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import {useEffect,useState} from 'react';
import BattleLoadingScreen from "@/components/BattleLoadingScreen";
import BattleUiAudio from "@/components/BattleUiAudio";
import BattleMenuMusic from "@/components/BattleMenuMusic";
import NexoraDialogProvider from "@/components/NexoraDialogProvider";
import PushNotificationBootstrap from "@/components/PushNotificationBootstrap";
import { isGameRoute } from "@/lib/game-routes";

const SiteRootChrome = dynamic(() => import("@/components/SiteRootChrome"));
const GameWebsite = dynamic(() => import("@/components/GameWebsite"));

export default function RootChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const { status } = useSession();
  const isEmbedRoute =
    pathname.startsWith("/blaze-embed") || pathname.startsWith("/market-embed");
  const isBattleRoute = isGameRoute(pathname);
  const [runtime,setRuntime]=useState<'checking'|'game'|'site'>('checking');
  useEffect(()=>{const bridge=(window as typeof window&{nexoraDesktop?:{isGameDesktop?:boolean}}).nexoraDesktop;setRuntime(bridge?.isGameDesktop?'game':'site');if(bridge?.isGameDesktop&&!isGameRoute(pathname))window.location.replace('/game')},[pathname]);

  if (isEmbedRoute) {
    return children;
  }

  if (isBattleRoute && !pathname.startsWith('/game') && runtime !== 'game') {
    return runtime === 'site' ? <GameWebsite /> : null;
  }

  if (isBattleRoute) {
    return (
      <>
        <NexoraDialogProvider />
        {status === "authenticated" && !pathname.startsWith("/game") && <BattleLoadingScreen />}
        {runtime === 'game' && <BattleUiAudio />}
        {runtime === 'game' && <BattleMenuMusic />}
        <PushNotificationBootstrap />
        {children}
      </>
    );
  }

  if(runtime!=='site')return null;
  return (
    <>
      <NexoraDialogProvider />
      <PushNotificationBootstrap />
      <SiteRootChrome>{children}</SiteRootChrome>
    </>
  );
}
