"use client";

import { SessionProvider } from "next-auth/react";
import SessionKillSwitch from "@/components/SessionKillSwitch";
import { LanguageProvider } from "@/lib/i18n";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider refetchInterval={10} refetchOnWindowFocus>
      <SessionKillSwitch />
      <LanguageProvider>{children}</LanguageProvider>
    </SessionProvider>
  );
}
