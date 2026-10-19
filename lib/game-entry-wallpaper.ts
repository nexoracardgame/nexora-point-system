import manifest from "../public/game-assets/video/entry-loop-3/manifest.json";

export const ENTRY_WALLPAPER_POSTER = manifest.poster;
export function entryWallpaperSources() {
  const device = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const compact = matchMedia("(pointer: coarse)").matches || device.connection?.saveData || (device.deviceMemory ?? 8) < 4;
  const large = !compact && window.innerWidth * Math.min(window.devicePixelRatio || 1, 2) >= 2560 && (device.deviceMemory ?? 8) >= 8;
  return manifest.variants.filter(item => item.width <= (compact ? 1280 : large ? 3840 : 1920)).map(item => item.url);
}
