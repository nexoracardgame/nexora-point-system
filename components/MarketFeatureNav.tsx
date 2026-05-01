"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Handshake, Plus, ShieldCheck } from "lucide-react";

const MARKET_ACTIONS = [
  {
    href: "/market/create",
    title: "Create Listing",
    subtitle: "สร้างโพสต์ขายการ์ด",
    Icon: Plus,
  },
  {
    href: "/market/deals",
    title: "Deal Requests",
    subtitle: "รับข้อเสนอและคุยดีล",
    Icon: Handshake,
  },
  {
    href: "/market/wishlist",
    title: "Wishlist",
    subtitle: "การ์ดที่ติดตามไว้",
    Icon: Heart,
  },
  {
    href: "/market/seller-center",
    title: "Seller Center",
    subtitle: "จัดการโพสต์ขาย",
    Icon: ShieldCheck,
  },
] as const;

function isActivePath(pathname: string, href: string) {
  const safePath = String(pathname || "").split("?")[0];
  return safePath === href || safePath.startsWith(`${href}/`);
}

export default function MarketFeatureNav({
  className = "",
}: {
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <section
      className={`grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 ${className}`}
    >
      {MARKET_ACTIONS.map(({ href, title, subtitle, Icon }) => {
        const active = isActivePath(pathname, href);

        return (
          <Link
            key={href}
            href={href}
            className={`group rounded-[24px] border p-4 shadow-[0_18px_54px_rgba(0,0,0,0.20)] transition duration-300 hover:-translate-y-1 md:rounded-[30px] md:p-5 ${
              active
                ? "border-black bg-black text-white ring-1 ring-white/14"
                : "border-black/8 bg-white text-black ring-1 ring-white/70 hover:shadow-[0_26px_70px_rgba(255,255,255,0.08)]"
            }`}
          >
            <div
              className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${
                active
                  ? "bg-white text-black"
                  : "bg-black text-amber-200 group-hover:scale-105"
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="text-sm font-black leading-tight md:text-base">
              {title}
            </div>
            <div
              className={`mt-1 text-[11px] font-bold leading-4 md:text-xs ${
                active ? "text-white/54" : "text-black/45"
              }`}
            >
              {subtitle}
            </div>
          </Link>
        );
      })}
    </section>
  );
}
