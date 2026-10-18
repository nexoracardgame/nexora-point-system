"use client";

import { useEffect } from "react";
import "./BattleMobileOverlays.css";
import GameLandscapeGuard from './GameLandscapeGuard';

type CapacitorRuntime = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
};

function getNativePlatform() {
  const runtime = (
    window as typeof window & { Capacitor?: CapacitorRuntime }
  ).Capacitor;

  if (!runtime?.isNativePlatform?.()) {
    return "";
  }

  return runtime.getPlatform?.() || "";
}

export default function NativeViewportBridge() {
  useEffect(() => {
    const root = document.documentElement;
    const platform = getNativePlatform();
    let lobbyObserver: ResizeObserver | undefined;
    let observedLobby: Element | null = null;
    const fitLobby = () => {
      const lobby = document.querySelector<HTMLElement>(".nexora-command-lobby");
      if (!lobby || lobby === observedLobby) return;
      lobbyObserver?.disconnect();
      observedLobby = lobby;
      lobbyObserver = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        const compact = width < 1100 || height < 650;
        const scale = Math.min(width / (compact ? 1400 : 1920), height / (compact ? 820 : 1080));
        lobby.style.setProperty("--lobby-drawer-scale", String(Math.max(.2, scale)));
      });
      lobbyObserver.observe(lobby);
    };
    const applyViewportVars = () => {
      const width = window.innerWidth || 390;
      const typing = document.activeElement?.matches("input,textarea,[contenteditable=true]");
      if (!typing) root.dataset.gamePortrait = String(width <= 1000 && window.matchMedia("(orientation:portrait)").matches);
      const viewportHeight = window.visualViewport?.height || window.innerHeight || 0;
      const compactTop = width <= 380 ? 30 : 34;
      const androidTop = width >= 700 ? 26 : compactTop;
      const nativeTop = platform === "android" ? androidTop : 0;

      root.dataset.nativePlatform = platform || "web";
      root.style.setProperty("--app-native-safe-top", `${nativeTop}px`);
      root.style.setProperty("--app-safe-top", `max(env(safe-area-inset-top), ${nativeTop}px)`);
      root.style.setProperty("--app-safe-bottom", "env(safe-area-inset-bottom)");
      if (viewportHeight > 0) {
        root.style.setProperty("--app-shell-height", `${Math.round(viewportHeight)}px`);
      }
      root.style.setProperty("--game-visual-width", `${window.visualViewport?.width || width}px`);
      root.style.setProperty("--game-visual-height", `${viewportHeight}px`);
      root.style.setProperty("--game-visual-left", `${window.visualViewport?.offsetLeft || 0}px`);
      root.style.setProperty("--game-visual-top", `${window.visualViewport?.offsetTop || 0}px`);
    };

    const enterGameFullscreen = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || document.fullscreenElement ||
          !document.querySelector(".nexora-battle-shell,.nexora-pentad-shell") ||
          (event.target as Element)?.closest("input,textarea")) return;
      void document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).then(() => {
        const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
        void orientation.lock?.("landscape").catch(() => {});
      }).catch(() => {});
    };
    const mutations = new MutationObserver(fitLobby);
    mutations.observe(document.body, { childList: true, subtree: true });
    fitLobby();
    document.addEventListener("pointerdown", enterGameFullscreen, { passive: true });

    applyViewportVars();
    window.addEventListener("resize", applyViewportVars);
    window.addEventListener("orientationchange", applyViewportVars);
    document.addEventListener("focusout", applyViewportVars);
    window.visualViewport?.addEventListener("resize", applyViewportVars);
    window.visualViewport?.addEventListener("scroll", applyViewportVars);

    return () => {
      window.removeEventListener("resize", applyViewportVars);
      window.removeEventListener("orientationchange", applyViewportVars);
      document.removeEventListener("focusout", applyViewportVars);
      window.visualViewport?.removeEventListener("resize", applyViewportVars);
      window.visualViewport?.removeEventListener("scroll", applyViewportVars);
      document.removeEventListener("pointerdown", enterGameFullscreen);
      mutations.disconnect();
      lobbyObserver?.disconnect();
    };
  }, []);

  return <GameLandscapeGuard/>;
}
