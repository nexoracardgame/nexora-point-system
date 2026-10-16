import type { Metadata } from "next";
import GameShell from "@/components/GameShell";

export const metadata: Metadata = {
  title: { absolute: "NEXORA CARD GAME" },
  description: "NEXORA online card game",
  applicationName: "NEXORA CARD GAME",
  manifest: "/game/manifest.webmanifest",
  icons: { icon: [{url:'/game-icons/favicon.ico',sizes:'any'},{url:'/game-icons/icon-32.png',sizes:'32x32',type:'image/png'}], apple:'/game-icons/icon-192.png', shortcut:'/game-icons/favicon.ico' },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "NEXORA CARD GAME" },
};

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <GameShell>{children}</GameShell>;
}
