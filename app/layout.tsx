import Providers from "./providers";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DEFAULT_LOCALE } from "@/lib/i18n-core";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NEXORA",
  description: "NEXORA CARDGAME Marketplace",

  // 🔥 PWA สำคัญ
  manifest: "/manifest.webmanifest",

  // 🔥 สีธีม (มือถือ / status bar)
  themeColor: "#050507",

  // 🔥 iOS รองรับ
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NEXORA",
  },

  // 🔥 favicon / icon
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = DEFAULT_LOCALE;

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#050507] text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}