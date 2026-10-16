"use client";

import "./BattleLoadingScreen.css";
import "./BattleMobileOverlays.css";

export default function BattleConnectingScreen() {
  return <div className="nexora-game-loading" role="status" aria-label="กำลังเชื่อมต่อสนาม"><div className="nexora-game-loading-wallpaper" /><div className="nexora-game-loading-content"><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME" /><div className="nexora-game-loading-track"><div /></div></div></div>;
}
