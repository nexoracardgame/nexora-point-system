import type { Metadata } from "next";
import GameShell from "@/components/GameShell";
import gameIcons from '@/public/game-assets/branding/icon-set.json';

export const metadata: Metadata = {
  title: { absolute: "NEXORA CARD GAME" },
  description: "NEXORA online card game",
  applicationName: "NEXORA CARD GAME",
  manifest: "/game/manifest.webmanifest",
  icons: { icon: [{url:`${gameIcons.favicon}?v=${gameIcons.version}`,sizes:'any'},{url:`${gameIcons.icons['32']}?v=${gameIcons.version}`,sizes:'32x32',type:'image/png'}], apple:`${gameIcons.icons['180']}?v=${gameIcons.version}`, shortcut:`${gameIcons.favicon}?v=${gameIcons.version}` },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "NEXORA CARD GAME" },
};

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <GameShell>{children}</GameShell>;
}
