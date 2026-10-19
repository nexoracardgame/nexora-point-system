import { loadLobbyAssets } from "./lobby-assets";
import manifest from "../public/game-assets/video/home-loop-2/manifest.json";
import preparationManifest from "../public/game-assets/video/home-loop/manifest.json";

export const HOME_WALLPAPER_POSTER = manifest.poster;
export const PREPARATION_WALLPAPER_POSTER = preparationManifest.poster;
export type WallpaperScene = "home" | "preparation";
export function homeWallpaperSources(scene: WallpaperScene = "home") {
  const device = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const compact = matchMedia("(pointer: coarse)").matches || device.connection?.saveData || (device.deviceMemory !== undefined && device.deviceMemory < 4);
  const large = !compact && window.innerWidth * Math.min(window.devicePixelRatio || 1, 2) >= 2560 && (device.deviceMemory ?? 8) >= 8;
  const selected = scene === "preparation" ? preparationManifest : manifest;
  return selected.variants.filter(variant => variant.width <= (compact ? 1280 : large ? 3840 : 1920)).map(variant => variant.url);
}

const wallpapers: Partial<Record<WallpaperScene, Promise<string>>> = {};
export function loadHomeWallpaper(scene: WallpaperScene = "home") {
  wallpapers[scene] ??= (async () => {
    // Interactive artwork must finish before large background downloads compete for bandwidth.
    await loadLobbyAssets().catch(() => {});
    return homeWallpaperSources(scene)[0];
  })().catch(error => { delete wallpapers[scene]; throw error; });
  return wallpapers[scene]!;
}
