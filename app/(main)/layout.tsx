"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, useEffect, useMemo } from "react";
import { signOut, useSession } from "next-auth/react";
import { MessageCircle } from "lucide-react";
import {
  Gem,
  Bell,
  Wallet,
  ShoppingBag,
  Gift,
  FolderKanban,
  Settings,
  LogOut,
  House,
  Cat,
  Trophy,
  X,
  ChevronRight,
  User,
} from "lucide-react";

function safeProfileSrc(image?: string | null) {
  const raw = String(image || "").trim();
  return raw || "/avatar.png";
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileImage, setProfileImage] = useState("");
  const [avatarReady, setAvatarReady] = useState(false);

  const stableAvatarRef = useRef("/avatar.png");
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    const nextImage = safeProfileSrc(session?.user?.image);

    function updateAvatar(src: string) {
      if (src !== stableAvatarRef.current) {
        stableAvatarRef.current = src;
        setAvatarReady(false);
        setProfileImage(src);
      } else {
        setAvatarReady(true);
      }
    }

    if (nextImage !== "/avatar.png") {
      updateAvatar(nextImage);
      return;
    }

    if (stableAvatarRef.current !== "/avatar.png") {
      setProfileImage(stableAvatarRef.current);
      setAvatarReady(true);
      return;
    }

    async function fallbackFetch() {
      try {
        const res = await fetch("/api/profile/me", {
          cache: "force-cache",
        });

        const data = await res.json();
        if (!mounted) return;

        const dbImage = safeProfileSrc(data?.image);

        if (dbImage !== "/avatar.png") {
          updateAvatar(dbImage);
        } else {
          setProfileImage("/avatar.png");
          setAvatarReady(true);
        }
      } catch {
        if (!mounted) return;
        setProfileImage("/avatar.png");
        setAvatarReady(true);
      }
    }

    fallbackFetch();

    return () => {
      mounted = false;
    };
  }, [session?.user?.image]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const prev = document.body.style.overflow;
    
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  const pageContext = useMemo(() => {
    if (pathname.startsWith("/market")) return "MARKET";
    if (pathname.startsWith("/collections")) return "COLLECTIONS";
    if (pathname.startsWith("/community")) return "COMMUNITY";
    if (pathname.startsWith("/redeem")) return "REDEEM";
    if (pathname.startsWith("/rewards")) return "REWARDS";
    if (pathname.startsWith("/wallet")) return "WALLET";
    if (pathname.startsWith("/dashboard")) return "DASHBOARD";
    return "NEXORA HOME";
  }, [pathname]);

  const sideItems = useMemo(
    () => [
      { href: "/", label: "Home", icon: House, active: pathname === "/" },
      {
        href: "/market",
        label: "Market",
        icon: ShoppingBag,
        active: pathname.startsWith("/market"),
      },
      {
        href: "/rewards",
        label: "Rewards",
        icon: Trophy,
        active: pathname.startsWith("/rewards"),
      },
      {
        href: "/redeem",
        label: "Redeem",
        icon: Gift,
        active: pathname.startsWith("/redeem"),
      },
      {
        href: "/collections",
        label: "Collections",
        icon: FolderKanban,
        active: pathname.startsWith("/collections"),
      },
      {
        href: "/community",
        label: "Community",
        icon: Cat,
        active: pathname.startsWith("/community"),
      },
      {
       href: "/dm",
       label: "Chat",
       icon: MessageCircle,
       active: pathname.startsWith("/dm"),
      },
    ],
    [pathname]
  );

  const mobileBottomItems = useMemo(
    () => [
      { href: "/", label: "Home", icon: House, active: pathname === "/" },
      {
        href: "/market",
        label: "Market",
        icon: ShoppingBag,
        active: pathname.startsWith("/market"),
      },
      {
        href: "/rewards",
        label: "Rewards",
        icon: Trophy,
        active: pathname.startsWith("/rewards"),
      },
      {
        href: "/dm",
        label: "Chat",
        icon: MessageCircle,
        active: pathname.startsWith("/dm"),
      },
    ],
    [pathname]
  );

  const drawerLinks = [
    ...sideItems,
    {
      href: "/wallet",
      label: "Wallet",
      icon: Wallet,
      active: pathname.startsWith("/wallet"),
    },
    {
      href: "/profile/me",
      label: "My Profile",
      icon: User,
      active: pathname.startsWith("/profile"),
    },
    {
      href: "/settings/profile",
      label: "Profile Settings",
      icon: Settings,
      active: pathname.startsWith("/settings/profile"),
    },
  ];

  return (
    <div className="min-h-screen bg-[#050608] text-white">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.08),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.06),transparent_24%)]" />

      <div className="relative flex min-h-screen">
        {/* DESKTOP LEFT DOCK */}
        <aside className="hidden xl:flex fixed left-0 top-0 h-screen w-[92px] min-w-[92px] border-r border-white/5 bg-[#0a0b0e]/95 xl:flex-col xl:items-center z-[600]">
          <div className="flex h-full w-full flex-col items-center py-5">
            <Link
              href="/"
              className="mb-6 flex h-14 w-14 items-center justify-center rounded-[20px] border border-amber-300/15 bg-[#12141a] text-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.18)] transition hover:scale-[1.03] hover:shadow-[0_0_34px_rgba(251,191,36,0.26)]"
            >
              <Gem className="h-5 w-5" />
            </Link>

            <div className="flex flex-col gap-3">
              {sideItems.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex h-12 w-12 items-center justify-center rounded-2xl border transition ${
                      item.active
                        ? "border-amber-300/20 bg-amber-300/12 text-amber-300 shadow-[0_0_22px_rgba(251,191,36,0.18)]"
                        : "border-white/5 bg-white/[0.02] text-white/45 hover:border-amber-300/10 hover:bg-amber-300/[0.06] hover:text-amber-200 hover:shadow-[0_0_18px_rgba(251,191,36,0.10)]"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <div className="relative z-0 flex min-w-0 flex-1 flex-col xl:ml-[92px]">
          {/* TOPBAR */}
          <header className="sticky top-0 z-[500] border-b border-white/5 bg-[#0b0c10]/88 backdrop-blur-2xl">
            <div className="flex h-[74px] items-center justify-between px-4 sm:px-5 xl:px-6">
              <div className="flex min-w-0 items-center gap-3">
                {/* MOBILE LOGO */}
                <Link
                  href="/"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/15 bg-[#12141a] text-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.16)] xl:hidden"
                >
                  <Gem className="h-5 w-5" />
                </Link>

                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35 sm:text-[11px]">
                    NEXORA COMMAND
                  </div>
                  <div className="truncate text-[20px] font-black leading-none sm:text-2xl">
                    {pageContext}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button className="hidden h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-amber-300 transition hover:bg-white/[0.06] hover:shadow-[0_0_18px_rgba(251,191,36,0.14)] sm:flex">
                  <Bell className="h-4 w-4" />
                </button>

                <Link
                  href="/wallet"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-amber-300 transition hover:bg-white/[0.06] hover:shadow-[0_0_18px_rgba(251,191,36,0.14)]"
                >
                  <Wallet className="h-4 w-4" />
                </Link>

                <div className="rounded-xl border border-amber-300/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),rgba(245,158,11,0.08))] px-3 py-2 text-xs font-black text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.14)] sm:px-4 sm:text-sm">
                  <span className="drop-shadow-[0_0_12px_rgba(251,191,36,0.55)]">
                    {session?.user?.nexPoint ?? 0}
                  </span>{" "}
                  <span className="text-amber-300">NEX</span>
                </div>

                {/* PROFILE */}
                <div className="relative z-[600]" ref={menuRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen((v) => !v);
                    }}
                    className={`relative h-10 w-10 overflow-hidden rounded-xl border border-amber-300/10 bg-[#111318] shadow-[0_0_18px_rgba(251,191,36,0.08)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_24px_rgba(251,191,36,0.18)] ${
                      menuOpen ? "ring-2 ring-amber-300/40" : ""
                    }`}
                  >
                    {profileImage && (
                      <img
                        src={profileImage}
                        loading="eager"
                        decoding="async"
                        alt="profile"
                        draggable={false}
                        onLoad={() => setAvatarReady(true)}
                        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out ${
                          avatarReady ? "opacity-100" : "opacity-0"
                        }`}
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.src.includes("/avatar.png")) {
                            stableAvatarRef.current = "/avatar.png";
                            setProfileImage("/avatar.png");
                            requestAnimationFrame(() => {
                              setAvatarReady(true);
                            });
                          }
                        }}
                      />
                    )}
                  </button>

                  {menuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-[calc(100%+12px)] z-[999] w-[280px] sm:w-[320px] rounded-[24px] border border-amber-300/12 bg-[#111318]/98 p-3 shadow-[0_40px_120px_rgba(0,0,0,0.6),0_0_40px_rgba(251,191,36,0.08)] backdrop-blur-2xl animate-[fadeIn_.18s_ease-out]"
                    >
                      <div className="mb-2 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                        <div className="text-xs uppercase tracking-[0.24em] text-white/35">
                          Commander
                        </div>
                        <div className="mt-1 truncate text-base font-black text-white">
                          {session?.user?.name || "NEXORA USER"}
                        </div>
                      </div>

                      <Link
                        href="/wallet"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/85 transition hover:bg-amber-300/[0.06]"
                      >
                        <Wallet className="h-4 w-4 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
                        Wallet
                      </Link>

                      <Link
                        href="/profile/me"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/85 transition hover:bg-amber-300/[0.06]"
                      >
                        <User className="h-4 w-4 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
                        My Profile
                      </Link>

                      <Link
                        href="/settings/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/85 transition hover:bg-amber-300/[0.06]"
                      >
                        <Settings className="h-4 w-4 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
                        Profile Settings
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          signOut({ callbackUrl: "/login" });
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-red-300 transition hover:bg-red-500/10"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* CONTENT */}
          <main className="relative z-0 min-w-0 flex-1 bg-[#07080b] p-3 sm:p-4 xl:p-6 pb-[90px] sm:pb-[100px] xl:pb-6">
            <div className="min-h-[calc(100vh-74px-92px)] rounded-[24px] border border-white/5 bg-[linear-gradient(180deg,#0b0d10_0%,#090a0d_100%)] p-3 shadow-[0_20px_80px_rgba(0,0,0,0.28)] sm:min-h-[calc(100vh-74px-96px)] sm:rounded-[26px] sm:p-4 xl:min-h-[calc(100vh-122px)] xl:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      <div
        className={`fixed inset-0 z-[1200] xl:hidden ${
          mobileNavOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          onClick={() => setMobileNavOpen(false)}
          className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition duration-300 ${
            mobileNavOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        <div
          ref={mobileDrawerRef}
          className={`absolute left-0 top-0 h-full w-[88%] max-w-[380px] border-r border-amber-300/10 bg-[linear-gradient(180deg,#0d0f14_0%,#090b0f_100%)] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.55)] transition-transform duration-300 ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-amber-300/15 bg-[#12141a] text-amber-300 shadow-[0_0_26px_rgba(251,191,36,0.16)]">
                <Gem className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.26em] text-white/35">
                  NEXORA
                </div>
                <div className="text-lg font-black">COMMAND MENU</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/70"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-5 rounded-[24px] border border-white/5 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-amber-300/10 bg-[#111318]">
                {profileImage && (
                  <img
                    src={profileImage}
                    alt="profile"
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-black">
                  {session?.user?.name || "NEXORA USER"}
                </div>
                <div className="mt-1 inline-flex rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-200">
                  {session?.user?.nexPoint ?? 0} TFT
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {drawerLinks.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-4 transition ${
                    item.active
                      ? "border-amber-300/18 bg-amber-300/10 text-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.10)]"
                      : "border-white/5 bg-white/[0.02] text-white/85 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        item.active
                          ? "bg-amber-300/12 text-amber-300"
                          : "bg-white/[0.04] text-white/65"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-bold">{item.label}</span>
                  </div>

                  <ChevronRight className="h-4 w-4 opacity-50" />
                </Link>
              );
            })}
          </div>

          <div className="mt-5 border-t border-white/5 pt-5">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center justify-between rounded-2xl border border-red-500/15 bg-red-500/10 px-4 py-4 text-left text-red-300 transition hover:bg-red-500/15"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                  <LogOut className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold">Logout</span>
              </div>
              <ChevronRight className="h-4 w-4 opacity-50" />
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <nav className="fixed bottom-[12px] left-0 right-0 z-[1100] border border-white/10 bg-[#0b0c10]/80 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.6)] xl:hidden mx-auto max-w-[640px] rounded-2xl">
        <div className="mx-auto grid max-w-[640px] grid-cols-4 gap-2">
          {mobileBottomItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[64px] flex-col items-center justify-center rounded-2xl border transition ${
                  item.active
                    ? "border-amber-300/18 bg-amber-300/10 text-amber-300 shadow-[0_0_22px_rgba(251,191,36,0.12)]"
                    : "border-transparent bg-white/[0.02] text-white/45"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="mt-1 text-[11px] font-bold">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}