export const LOBBY_ACTION_ART = "/images/triad/lobby-action-sprite.webp";
let ready: Promise<void> | undefined;

export function loadLobbyAssets(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  ready ??= new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.fetchPriority = "high";
    image.onload = () => { void image.decode().then(() => resolve(), reject); };
    image.onerror = () => reject(new Error("Lobby action artwork unavailable"));
    image.src = LOBBY_ACTION_ART;
  }).catch(error => { ready = undefined; throw error; });
  return ready;
}
