export const LOBBY_ACTION_ART = "/images/triad/lobby-action-sprite.webp";
export const LOBBY_ASSET_VERSION = 'local-resource-pack-3';
export const PLAY_DRAWER_ART = '/game-assets/ui/play-drawer-v2/drawer.webp';
export const LOBBY_READY_ART = [LOBBY_ACTION_ART,'/images/lobby-play/play-button.webp',PLAY_DRAWER_ART];
let ready: Promise<void> | undefined;
const images=new Map<string,{image:HTMLImageElement;ready:Promise<void>}>();

export function loadLobbyAssets(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  ready ??= Promise.all(LOBBY_READY_ART.map(src=>{
    const cached=images.get(src);if(cached)return cached.ready;
    const image = new Image();
    image.fetchPriority = "high";
    const decoded=new Promise<void>((resolve,reject)=>{
      image.onload = () => { void image.decode().then(() => resolve(), reject); };
      image.onerror = () => reject(new Error("Lobby artwork unavailable: "+src));
      image.src = src;
    }).catch(error=>{images.delete(src);throw error});
    images.set(src,{image,ready:decoded});return decoded;
  })).then(()=>{}).catch(error => { ready = undefined; throw error; });
  return ready;
}
