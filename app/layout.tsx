import Providers from "./providers";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DEFAULT_LOCALE } from "@/lib/i18n-core";
import "./globals.css";

import AppSplash from "@/components/AppSplash";
import PageTransition from "@/components/PageTransition";
import MobileNav from "@/components/MobileNav";

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

/* 🔥 META (PWA + APP MODE) */
export const metadata: Metadata = {
  title: "NEXORA",
  description: "NEXORA CARDGAME Marketplace",
  applicationName: "NEXORA",

  manifest: "/manifest",
  themeColor: "#050507",

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

  colorScheme: "dark",
};

/* 🔥 MOBILE VIEW */
export const viewport: Viewport = {
  themeColor: "#050507",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="
          min-h-full flex flex-col
          bg-[#050507] text-white
          overflow-x-hidden
          selection:bg-amber-400/20 selection:text-amber-200
        "
      >
        {/* 🔥 Splash ครั้งแรก */}
        <AppSplash />

        {/* 🔥 App Core */}
        <Providers>
          {/* 🔥 Transition เร็วแบบแอพ (ไม่มีหน่วง) */}
          <PageTransition>
            <main className="flex-1 flex flex-col pb-16">
              {children}
            </main>
          </PageTransition>

          {/* 🔥 เมนูติดล่างแบบแอพ */}
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}