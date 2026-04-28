"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MobileNav() {
  const pathname = usePathname();

  const item = (href: string, label: string) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`flex flex-col items-center justify-center text-xs ${
          active ? "text-amber-400" : "text-white/40"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[999] bg-[#050507]/90 backdrop-blur border-t border-white/10 h-14 flex justify-around items-center">
      {item("/", "HOME")}
      {item("/market", "MARKET")}
      {item("/wallet", "WALLET")}
      {item("/profile", "ME")}
    </div>
  );
}