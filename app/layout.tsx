import Providers from "./providers";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DEFAULT_LOCALE } from "@/lib/i18n-core";
import "./globals.css";

import PageTransition from "@/components/PageTransition";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NEXORA POINT",
  description: "NEXORA CARDGAME Marketplace",
  applicationName: "NEXORA",
  manifest: "/manifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NEXORA",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#050507",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = DEFAULT_LOCALE;

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full bg-[#050507] antialiased`}
    >
      <body
        className="
          flex min-h-[100dvh] flex-col
          bg-[#050507] text-white
          overflow-x-hidden
          selection:bg-amber-400/20 selection:text-amber-200
        "
      >
        <Providers>
          <PageTransition>
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </PageTransition>
        </Providers>
      </body>
    </html>
  );
}
