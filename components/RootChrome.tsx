"use client";

import { usePathname } from "next/navigation";
import FirstOpenSplash from "@/components/FirstOpenSplash";
import GlobalActivityBar from "@/components/GlobalActivityBar";
import NexoraDialogProvider from "@/components/NexoraDialogProvider";
import PageTransition from "@/components/PageTransition";
import PushNotificationBootstrap from "@/components/PushNotificationBootstrap";

export default function RootChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const isEmbedRoute = pathname.startsWith("/blaze-embed");

  if (isEmbedRoute) {
    return children;
  }

  return (
    <>
      <NexoraDialogProvider />
      <PushNotificationBootstrap />
      <FirstOpenSplash />
      <GlobalActivityBar />
      <PageTransition>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </PageTransition>
    </>
  );
}
