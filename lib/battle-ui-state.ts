"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

const event = "nexora:arena-activity";
const subscribe = (listener: () => void) => {
  window.addEventListener(event, listener);
  return () => window.removeEventListener(event, listener);
};
const snapshot = () => document.documentElement.dataset.nexoraArenaActive === "true";
export function useBattleArenaActive() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
export function useBattleArenaActivity(active: boolean) {
  useLayoutEffect(() => {
    const update = (value: boolean) => {
      document.documentElement.dataset.nexoraArenaActive = String(value);
      window.dispatchEvent(new Event(event));
    };
    update(active);
    return () => update(false);
  }, [active]);
}
