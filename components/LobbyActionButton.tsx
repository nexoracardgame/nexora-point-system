"use client";

import { useState } from "react";
import { playGameUiSound } from "@/lib/game-ui-audio";
import "./LobbyActionButton.css";

type Props = { artwork: "play" | "join" | "rank"; title: string; subtitle: string; onClick: () => void };

export default function LobbyActionButton({ artwork, title, subtitle, onClick }: Props) {
  const [flash, setFlash] = useState(0);
  return <button type="button" className="nexora-command-mode nexora-lobby-art-button" data-artwork={artwork}
    onPointerEnter={event => { if (event.pointerType === "mouse") playGameUiSound("click"); }}
    onClick={() => { setFlash(value => value + 1); onClick(); }}>
    <span className="nexora-lobby-art-crop" aria-hidden="true"><img src="/images/triad/lobby-action-sprite.png" alt="" draggable={false} /></span>
    <span className="nexora-lobby-art-copy"><strong>{title}</strong><small>{subtitle}</small></span>
    {flash > 0 && <span key={flash} className="nexora-lobby-art-flash" aria-hidden="true" />}
  </button>;
}
