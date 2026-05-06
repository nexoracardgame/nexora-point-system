"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Gift,
  Menu,
  ScanLine,
  ScrollText,
  Shield,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const navItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        active: item.exact ? pathname === item.href : pathname.startsWith(item.href),
      })),
    [pathname]
  );

  useEffect(() => {
    const warmTimer = window.setTimeout(() => {
      for (const item of items) {
        router.prefetch(item.href);
      }
    }, 250);

    return () => {
      window.clearTimeout(warmTimer);
    };
  }, [router]);

  const prefetchAdminRoute = (href: string) => {
    router.prefetch(href);
  };

  const HomeLink = ({ compact = false }: { compact?: boolean }) => (
    <Link
      href="/"
      prefetch
      onMouseEnter={() => router.prefetch("/")}
      onFocus={() => router.prefetch("/")}
      onTouchStart={() => router.prefetch("/")}
      onClick={() => setOpen(false)}
      className={`inline-flex items-center gap-2 rounded-2xl border border-amber-300/14 bg-amber-300/[0.07] font-black text-amber-100 shadow-[0_0_22px_rgba(251,191,36,0.08)] transition hover:border-amber-300/28 hover:bg-amber-300/[0.11] hover:text-amber-50 ${
        compact ? "h-11 px-3 text-xs" : "px-4 py-3 text-sm"
      }`}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" />
      <span className={compact ? "hidden sm:inline" : undefined}>กลับหน้าหลัก</span>
    </Link>
  );

  const Nav = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className={`flex ${mobile ? "flex-col gap-2" : "flex-col gap-3"}`}>
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onMouseEnter={() => prefetchAdminRoute(item.href)}
            onFocus={() => prefetchAdminRoute(item.href)}
            onTouchStart={() => prefetchAdminRoute(item.href)}
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
          <HomeLink />
          <div className="mt-5 text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">
            NEXORA
          </div>
          <div className="mt-2 text-2xl font-black text-amber-300">Admin Core</div>
        </div>
        <Nav />
      </aside>

      <div className="sticky top-0 z-50 w-full border-b border-white/8 bg-[#090b11]/95 px-3 py-3 backdrop-blur-2xl sm:px-4 xl:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <HomeLink compact />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">
                NEXORA
              </div>
              <div className="truncate text-lg font-black text-amber-300">
                Admin Core
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white"
            aria-label="Open admin menu"
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
          <div className="absolute right-0 top-0 h-full w-[88%] max-w-[360px] overflow-y-auto border-l border-white/10 bg-[#090b11] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.6)]">
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
                aria-label="Close admin menu"
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
