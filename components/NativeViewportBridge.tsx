"use client";

import { useEffect } from "react";

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
    const applyViewportVars = () => {
      const width = window.innerWidth || 390;
      const compactTop = width <= 380 ? 30 : 34;
      const androidTop = width >= 700 ? 26 : compactTop;
      const nativeTop = platform === "android" ? androidTop : 0;

      root.dataset.nativePlatform = platform || "web";
      root.style.setProperty("--app-native-safe-top", `${nativeTop}px`);
      root.style.setProperty("--app-safe-top", `max(env(safe-area-inset-top), ${nativeTop}px)`);
      root.style.setProperty("--app-safe-bottom", "env(safe-area-inset-bottom)");
    };

    applyViewportVars();
    window.addEventListener("resize", applyViewportVars);
    window.addEventListener("orientationchange", applyViewportVars);

    return () => {
      window.removeEventListener("resize", applyViewportVars);
      window.removeEventListener("orientationchange", applyViewportVars);
    };
  }, []);

  return null;
}
