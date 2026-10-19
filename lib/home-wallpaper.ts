import { loadLobbyAssets } from "./lobby-assets";
import manifest from "../public/game-assets/video/home-loop/manifest.json";

export const HOME_WALLPAPER_POSTER = manifest.poster;
export function homeWallpaperSources() {
  const device = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const compact = matchMedia("(pointer: coarse)").matches || device.connection?.saveData || (device.deviceMemory !== undefined && device.deviceMemory < 4);
  const large = !compact && window.innerWidth * Math.min(window.devicePixelRatio || 1, 2) >= 2560 && (device.deviceMemory ?? 8) >= 8;
  return manifest.variants.filter(variant => variant.width <= (compact ? 1280 : large ? 3840 : 1920)).map(variant => variant.url);
}

let wallpaper: Promise<string> | undefined;
export function loadHomeWallpaper() {
  wallpaper ??= (async () => {
    // Interactive artwork must finish before large background downloads compete for bandwidth.
    await loadLobbyAssets().catch(() => {});
    return homeWallpaperSources()[0];
  })().catch(error => { wallpaper = undefined; throw error; });
  return wallpaper;
}
