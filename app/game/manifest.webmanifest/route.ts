export function GET() {
  return Response.json({
    id: "/game", name: "NEXORA CARD GAME", short_name: "NEXORA CARD GAME",
    description: "NEXORA online card game", start_url: "/game", scope: "/game",
    display: "fullscreen", display_override: ["fullscreen", "standalone"], orientation: "landscape",
    background_color: "#050507", theme_color: "#050507", categories: ["games", "entertainment"],
    icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }],
  }, { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
