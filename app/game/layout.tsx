import type { Metadata } from "next";
import GameShell from "@/components/GameShell";

export const metadata: Metadata = {
  title: { absolute: "NEXORA CARD GAME" },
  description: "NEXORA online card game",
  applicationName: "NEXORA CARD GAME",
  manifest: "/game/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "NEXORA CARD GAME" },
};

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <GameShell>{children}</GameShell>;
}
