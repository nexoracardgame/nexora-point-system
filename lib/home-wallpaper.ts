import { loadLobbyAssets } from "./lobby-assets";

let wallpaper: Promise<string> | undefined;
export function loadHomeWallpaper() {
  wallpaper ??= (async () => {
    // Interactive artwork must finish before large background downloads compete for bandwidth.
    await loadLobbyAssets().catch(() => {});
    const base = "/videos/nexora-home-4k/";
    const response = await fetch(base + "manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Wallpaper manifest unavailable");
    const manifest = await response.json() as { width: number; height: number; bytes: number; sha256: string; parts: string[] };
    if (manifest.width !== 3840 || manifest.height !== 2160) throw new Error("Wallpaper must be 4K");
    const parts = await Promise.all(manifest.parts.map(async part => {
      if (!/^part-\d+\.bin$/.test(part)) throw new Error("Invalid wallpaper part");
      const response = await fetch(base + part + "?v=" + encodeURIComponent(manifest.sha256));
      if (!response.ok) throw new Error("Wallpaper part unavailable");
      return response.blob();
    }));
    const original = new Blob(parts, { type: "video/mp4" });
    if (original.size !== manifest.bytes) throw new Error("Incomplete wallpaper");
    return URL.createObjectURL(original);
  })().catch(error => { wallpaper = undefined; throw error; });
  return wallpaper;
}
