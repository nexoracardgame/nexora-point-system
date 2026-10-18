import gameIcons from '@/public/game-assets/branding/icon-set.json';
export function GET() {
  return Response.json({
    id: "/game", name: "NEXORA CARD GAME", short_name: "NEXORA CARD GAME",
    description: "NEXORA online card game", start_url: "/game", scope: "/game",
    display: "fullscreen", display_override: ["fullscreen", "standalone"], orientation: "landscape",
    background_color: "#050507", theme_color: "#050507", categories: ["games", "entertainment"],
    icons: [{ src: `${gameIcons.icons['192']}?v=${gameIcons.version}`, sizes: "192x192", type: "image/png", purpose: "any" }, { src: `${gameIcons.icons['512']}?v=${gameIcons.version}`, sizes: "512x512", type: "image/png", purpose: "any" }],
  }, { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
