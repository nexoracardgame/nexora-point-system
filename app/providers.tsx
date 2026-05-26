"use client";

import { SessionProvider } from "next-auth/react";
import SessionKillSwitch from "@/components/SessionKillSwitch";
import NativeViewportBridge from "@/components/NativeViewportBridge";
import { LanguageProvider } from "@/lib/i18n";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider refetchInterval={10} refetchOnWindowFocus>
      <NativeViewportBridge />
      <SessionKillSwitch />
      <LanguageProvider>{children}</LanguageProvider>
    </SessionProvider>
  );
}
