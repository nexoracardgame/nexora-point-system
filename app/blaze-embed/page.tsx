import type { Metadata, Viewport } from "next";
import BlazeEmbedClient from "./BlazeEmbedClient";

export const metadata: Metadata = {
  title: "ท่านเบลซ | NEXORA AI",
  description: "Blaze Warlock NEXORA AI iframe chat",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050403",
};

export default function BlazeEmbedPage() {
  return <BlazeEmbedClient />;
}
