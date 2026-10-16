"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { playGameUiSound } from "@/lib/game-ui-audio";
import { LOBBY_ACTION_ART } from "@/lib/lobby-assets";
import "./LobbyActionButton.css";

type Props = { artwork: "play" | "join" | "rank"; title: string; subtitle: string; onClick: () => void };

export default function LobbyActionButton({ artwork, title, subtitle, onClick }: Props) {
  const [flash, setFlash] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const button = <button type="button" className="nexora-command-mode nexora-lobby-art-button" data-artwork={artwork}
    onPointerEnter={event => { if (event.pointerType === "mouse") playGameUiSound("click"); }}
    onClick={() => { setFlash(value => value + 1); onClick(); }}>
    <span className="nexora-lobby-art-crop" aria-hidden="true"><img src={artwork==='play'?'/images/lobby-play/play-button.webp':LOBBY_ACTION_ART} alt="" width={1920} height={819} loading="eager" fetchPriority="high" decoding="sync" draggable={false} /></span>
    <span className="nexora-lobby-art-copy"><strong>{title}</strong><small>{subtitle}</small></span>
    {flash > 0 && <span key={flash} className="nexora-lobby-art-flash" aria-hidden="true" />}
  </button>;
  if (artwork !== "play") return button;
  return mounted ? createPortal(<div className="nexora-command-lobby nexora-play-viewport-control"><div className="nexora-command-actions">{button}</div></div>, document.body) : null;
}
