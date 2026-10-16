"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import BattleLoadingScreen from "@/components/BattleLoadingScreen";
import BattleUiAudio from "@/components/BattleUiAudio";
import BattleMenuMusic from "@/components/BattleMenuMusic";
import NexoraDialogProvider from "@/components/NexoraDialogProvider";
import PushNotificationBootstrap from "@/components/PushNotificationBootstrap";
import { isGameRoute } from "@/lib/game-routes";

const SiteRootChrome = dynamic(() => import("@/components/SiteRootChrome"));

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

  if (isEmbedRoute) {
    return children;
  }

  if (isBattleRoute) {
    return (
      <>
        <NexoraDialogProvider />
        {status === "authenticated" && pathname !== "/game/login" && <BattleLoadingScreen />}
        <BattleUiAudio />
        <BattleMenuMusic />
        <PushNotificationBootstrap />
        {children}
      </>
    );
  }

  return (
    <>
      <NexoraDialogProvider />
      <PushNotificationBootstrap />
      <SiteRootChrome>{children}</SiteRootChrome>
    </>
  );
}
