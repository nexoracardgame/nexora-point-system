"use client";

import { usePathname } from "next/navigation";
import FirstOpenSplash from "@/components/FirstOpenSplash";
import BattleLoadingScreen from "@/components/BattleLoadingScreen";
import BattleUiAudio from "@/components/BattleUiAudio";
import GlobalActivityBar from "@/components/GlobalActivityBar";
import InstantNavigationFeedback from "@/components/InstantNavigationFeedback";
import NexoraDialogProvider from "@/components/NexoraDialogProvider";
import PageTransition from "@/components/PageTransition";
import PushNotificationBootstrap from "@/components/PushNotificationBootstrap";

export default function RootChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const isEmbedRoute =
    pathname.startsWith("/blaze-embed") || pathname.startsWith("/market-embed");
  const isBattleRoute = pathname.startsWith("/battle");

  if (isEmbedRoute) {
    return children;
  }

  if (isBattleRoute) {
    return (
      <>
        <NexoraDialogProvider />
        <BattleLoadingScreen />
        <BattleUiAudio />
        <PushNotificationBootstrap />
        {children}
      </>
    );
  }

  return (
    <>
      <NexoraDialogProvider />
      <PushNotificationBootstrap />
      <FirstOpenSplash />
      <GlobalActivityBar />
      <InstantNavigationFeedback />
      <PageTransition>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </PageTransition>
    </>
  );
}
