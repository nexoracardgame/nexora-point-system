import manifest from "../public/game-assets/video/entry-loop-3/manifest.json";
import shopManifest from "../public/game-assets/video/shop-loop-5/manifest.json";
import collectionManifest from "../public/game-assets/video/collection-loop-6/manifest.json";

export const ENTRY_WALLPAPER_POSTER = manifest.poster;
export type EntryWallpaperScene = "entry" | "shop" | "collection";
const sceneManifest = (scene: EntryWallpaperScene) => scene === "collection" ? collectionManifest : scene === "shop" ? shopManifest : manifest;
export function entryWallpaperPoster(scene: EntryWallpaperScene = "entry") {
  return sceneManifest(scene).poster;
}
export function entryWallpaperSources(scene: EntryWallpaperScene = "entry", containerWidth = window.innerWidth) {
  const device = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const compact = matchMedia("(pointer: coarse)").matches || device.connection?.saveData || (device.deviceMemory ?? 8) < 4;
  const large = !compact && containerWidth * Math.min(window.devicePixelRatio || 1, 2) >= 2560 && (device.deviceMemory ?? 8) >= 8;
  const selected = sceneManifest(scene);
  return selected.variants.filter(item => item.width <= (compact ? 1280 : large ? 3840 : 1920)).map(item => item.url);
}
