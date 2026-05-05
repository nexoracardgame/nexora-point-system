"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, HandCoins, Heart, Settings2 } from "lucide-react";

const BUY_MARKET_ACTIONS = [
  {
    href: "/buy-market/create",
    title: "Create Buy Post",
    subtitle: "สร้างการ์ดรับซื้อ",
    Icon: HandCoins,
  },
  {
    href: "/buy-market/deals",
    title: "Buy Deal Requests",
    subtitle: "ดูคำขอดีลรับซื้อ",
    Icon: ClipboardList,
  },
  {
    href: "/buy-market/wishlist",
    title: "Following",
    subtitle: "รายการที่ติดตามไว้",
    Icon: Heart,
  },
  {
    href: "/buy-market/center",
    title: "Buy Post Center",
    subtitle: "จัดการโพสต์รับซื้อและลบรายการ",
    Icon: Settings2,
  },
] as const;

function isActivePath(pathname: string, href: string) {
  const safePath = String(pathname || "").split("?")[0];
  return safePath === href || safePath.startsWith(`${href}/`);
}

export default function BuyMarketFeatureNav({
  className = "",
}: {
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <section
      className={`grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 ${className}`}
    >
      {BUY_MARKET_ACTIONS.map(({ href, title, subtitle, Icon }) => {
        const active = isActivePath(pathname, href);

        return (
          <Link
            key={href}
            href={href}
            className={`group rounded-[24px] border p-4 shadow-[0_18px_54px_rgba(0,0,0,0.20)] transition duration-300 hover:-translate-y-1 md:rounded-[30px] md:p-5 ${
              active
                ? "border-white bg-black text-white ring-1 ring-white/14"
                : "border-black/8 bg-white text-black ring-1 ring-white/70 hover:border-black/20"
            }`}
          >
            <div
              className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${
                active
                  ? "bg-white text-black"
                  : "bg-black text-white group-hover:scale-105"
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
