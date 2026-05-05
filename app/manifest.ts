import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NEX POINT",
    short_name: "NEX POINT",
    description: "NEX POINT",
    start_url: "/",
    display: "standalone",
    background_color: "#050507",
    theme_color: "#050507",
    icons: [
      {
        src: "/icon-192-nex-point.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512-nex-point.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
