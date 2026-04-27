"use client";

import Link from "next/link";
import { Menu, Shield, Users, Gift, Ticket, ScrollText, ScanLine, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

const items = [
  { href: "/admin", label: "Dashboard", icon: Shield, exact: true },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/rewards", label: "Rewards", icon: Gift },
  { href: "/admin/coupons", label: "Coupons", icon: Ticket },
  { href: "/admin/point-logs", label: "Point Logs", icon: ScrollText },
  { href: "/staff", label: "Staff Scan", icon: ScanLine },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        active: item.exact ? pathname === item.href : pathname.startsWith(item.href),
      })),
    [pathname]
  );

  const Nav = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className={`flex ${mobile ? "flex-col gap-2" : "flex-col gap-3"}`}>
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
              item.active
                ? "border-amber-300/25 bg-amber-300/12 text-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.12)]"
                : "border-white/8 bg-white/[0.03] text-white/78 hover:border-white/12 hover:bg-white/[0.05]"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside className="hidden w-[264px] shrink-0 border-r border-white/8 bg-[#090b11]/96 p-5 xl:block">
        <div className="mb-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">
            NEXORA
          </div>
          <div className="mt-2 text-2xl font-black text-amber-300">Admin Core</div>
        </div>
        <Nav />
      </aside>

      <div className="sticky top-0 z-50 border-b border-white/8 bg-[#090b11]/95 px-4 py-3 backdrop-blur-2xl xl:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">
              NEXORA
            </div>
            <div className="text-lg font-black text-amber-300">Admin Core</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[1200] xl:hidden">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="absolute right-0 top-0 h-full w-[86%] max-w-[360px] border-l border-white/10 bg-[#090b11] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.6)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">
                  NEXORA
                </div>
                <div className="text-lg font-black text-amber-300">Admin Core</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Nav mobile />
          </div>
        </div>
      ) : null}
    </>
  );
}
