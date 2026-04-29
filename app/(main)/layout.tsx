"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useRef, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { MessageCircle } from "lucide-react";
import PrefetchLink from "@/components/PrefetchLink";
import NotificationBell from "@/components/NotificationBell";
import { useLanguage } from "@/lib/i18n";
import { listenProfileSync } from "@/lib/profile-sync";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";
import {
  readClientViewCache,
  writeClientViewCache,
} from "@/lib/client-view-cache";
import {
  Gem,
  Coins,
  Wallet,
  ShoppingBag,
  Gift,
  ArrowLeft,
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

function formatBalance(value?: number | null) {
  return Number(value || 0).toLocaleString("th-TH");
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLanguage();
  const isChatRoomPage =
    pathname.startsWith("/dm/") || pathname.startsWith("/market/deals/chat/");

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileImage, setProfileImage] = useState("");
  const [profileName, setProfileName] = useState("");
  const [avatarReady, setAvatarReady] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [walletUnreadCount, setWalletUnreadCount] = useState(0);
  const [liveBalances, setLiveBalances] = useState({
    nexPoint: Number(session?.user?.nexPoint || 0),
    coin: Number(session?.user?.coin || 0),
  });

  const stableAvatarRef = useRef("/avatar.png");
  const profileVersionRef = useRef("");
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const ownProfileHref = session?.user?.id
    ? `/profile/${session.user.id}`
    : "/profile/me";

  function updateAvatar(src?: string | null) {
    const nextSrc = safeProfileSrc(src);

    if (nextSrc !== stableAvatarRef.current) {
      stableAvatarRef.current = nextSrc;
      setAvatarReady(false);
      setProfileImage(nextSrc);
      return;
    }

    setAvatarReady(true);
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setLiveBalances({
        nexPoint: Number(session?.user?.nexPoint || 0),
        coin: Number(session?.user?.coin || 0),
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [session?.user?.coin, session?.user?.nexPoint]);

  useEffect(() => {
    const handleBalanceUpdate = (
      event: Event
    ) => {
      const detail = (event as CustomEvent<{
        nexPoint?: number;
        coin?: number;
      }>).detail;

      if (!detail) {
        return;
      }

      setLiveBalances((current) => ({
        nexPoint: Number(
          detail.nexPoint != null ? detail.nexPoint : current.nexPoint
        ),
        coin: Number(detail.coin != null ? detail.coin : current.coin),
      }));
    };

    window.addEventListener(
      "nexora:balance-updated",
      handleBalanceUpdate as EventListener
    );

    return () => {
      window.removeEventListener(
        "nexora:balance-updated",
        handleBalanceUpdate as EventListener
      );
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const root = document.documentElement;
    let rafId = 0;
    let timeoutA = 0;
    let timeoutB = 0;

    const syncShellHeight = () => {
      const nextHeight = Math.round(
        window.visualViewport?.height || window.innerHeight || 0
      );
      if (nextHeight > 0) {
        root.style.setProperty("--app-shell-height", `${nextHeight}px`);
      }
    };

    const scheduleShellHeightSync = () => {
      syncShellHeight();

      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      if (timeoutA) {
        window.clearTimeout(timeoutA);
      }
      if (timeoutB) {
        window.clearTimeout(timeoutB);
      }

      rafId = window.requestAnimationFrame(syncShellHeight);
      timeoutA = window.setTimeout(syncShellHeight, 120);
      timeoutB = window.setTimeout(syncShellHeight, 320);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        scheduleShellHeightSync();
      }
    };

    scheduleShellHeightSync();
    window.addEventListener("resize", scheduleShellHeightSync);
    window.addEventListener("orientationchange", scheduleShellHeightSync);
    window.addEventListener("focus", scheduleShellHeightSync);
    window.addEventListener("pageshow", scheduleShellHeightSync);
    document.addEventListener("visibilitychange", handleVisibility);
    window.visualViewport?.addEventListener("resize", scheduleShellHeightSync);
    window.visualViewport?.addEventListener("scroll", scheduleShellHeightSync);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      if (timeoutA) {
        window.clearTimeout(timeoutA);
      }
      if (timeoutB) {
        window.clearTimeout(timeoutB);
      }
      window.removeEventListener("resize", scheduleShellHeightSync);
      window.removeEventListener("orientationchange", scheduleShellHeightSync);
      window.removeEventListener("focus", scheduleShellHeightSync);
      window.removeEventListener("pageshow", scheduleShellHeightSync);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.visualViewport?.removeEventListener(
        "resize",
        scheduleShellHeightSync
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        scheduleShellHeightSync
      );
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function fallbackFetch() {
      try {
        const res = await fetch("/api/profile/me", {
          cache: "no-store",
        });

        const data = await res.json();
        if (!mounted) return;

        const dbImage = safeProfileSrc(data?.image);
        const dbName = String(data?.displayName || data?.name || "").trim();
        const dbUpdatedAt = String(data?.updatedAt || "").trim();
        const sessionImage = safeProfileSrc(session?.user?.image);
        const sessionName = String(session?.user?.name || "").trim();
        const nextVersion = [dbUpdatedAt, dbImage, dbName].join("|");

        if (dbImage !== "/avatar.png") {
          updateAvatar(dbImage);
        } else if (sessionImage !== "/avatar.png") {
          updateAvatar(sessionImage);
        } else {
          setProfileImage("/avatar.png");
          setAvatarReady(true);
        }

        if (dbName) {
          setProfileName(dbName);
        } else if (sessionName) {
          setProfileName(sessionName);
        }

        profileVersionRef.current =
          nextVersion || [sessionImage, sessionName].join("|");
      } catch {
        if (!mounted) return;
        const sessionImage = safeProfileSrc(session?.user?.image);
        const sessionName = String(session?.user?.name || "").trim();

        updateAvatar(sessionImage);
        if (sessionName) {
          setProfileName(sessionName);
        }

        profileVersionRef.current = [sessionImage, sessionName].join("|");
      }
    }

    fallbackFetch();

    return () => {
      mounted = false;
    };
  }, [session?.user?.image, session?.user?.name]);

  useEffect(() => {
    return listenProfileSync((detail) => {
      updateAvatar(detail.image);
      if (typeof detail.name === "string" && detail.name.trim()) {
        setProfileName(detail.name.trim());
      }
      profileVersionRef.current = [
        String(detail.timestamp || ""),
        safeProfileSrc(detail.image),
        String(detail.name || "").trim(),
      ].join("|");
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const syncLatestProfile = async () => {
      if (cancelled || document.visibilityState !== "visible") {
        return;
      }

      try {
        const res = await fetch(`/api/profile/me?ts=${Date.now()}`, {
          cache: "no-store",
        });

        if (!res.ok || cancelled) {
          return;
        }

        const data = await res.json();
        if (cancelled) {
          return;
        }

        const nextName = String(data?.displayName || data?.name || "").trim();
        const nextImage = safeProfileSrc(data?.image);
        const nextUpdatedAt = String(data?.updatedAt || "").trim();
        const nextVersion = [nextUpdatedAt, nextImage, nextName].join("|");

        if (!nextVersion || nextVersion === profileVersionRef.current) {
          return;
        }

        profileVersionRef.current = nextVersion;
        updateAvatar(nextImage);

        if (nextName) {
          setProfileName(nextName);
        }

        router.refresh();
      } catch {
        return;
      }
    };

    const startPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
      }

      intervalId = setInterval(syncLatestProfile, 2500);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncLatestProfile();
      }
    };

    const handleFocus = () => {
      void syncLatestProfile();
    };

    startPolling();
    void syncLatestProfile();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserSupabaseClient();
    const channel = supabase
      ? supabase.channel(`layout-chat-unread-${Date.now()}`)
      : null;

    const syncChatUnread = async () => {
      if (cancelled) return;

      try {
        const res = await fetch(`/api/dm/unread?ts=${Date.now()}`, {
          cache: "no-store",
        });

        if (!res.ok || cancelled) return;

        const data = await res.json();
        if (cancelled) return;

        setChatUnreadCount(Math.max(0, Number(data?.count || 0)));
      } catch {
        return;
      }
    };

    channel?.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dmMessage" },
      () => {
        void syncChatUnread();
      }
    );

    channel?.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dm_room" },
      () => {
        void syncChatUnread();
      }
    );

    channel?.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "DealRequest" },
      () => {
        void syncChatUnread();
      }
    );

    channel?.subscribe();

    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncChatUnread();
      }
    }, 15000);

    const handleFocus = () => {
      void syncChatUnread();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncChatUnread();
      }
    };
    const handleChatRead = () => {
      void syncChatUnread();
    };

    void syncChatUnread();
    window.addEventListener("focus", handleFocus);
    window.addEventListener("nexora:chat-read", handleChatRead);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("nexora:chat-read", handleChatRead);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (supabase && channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const syncWalletUnread = async () => {
      if (cancelled) return;

      try {
        const res = await fetch(`/api/wallet/notifications?ts=${Date.now()}`, {
          cache: "no-store",
        });

        if (!res.ok || cancelled) return;

        const data = await res.json();
        if (cancelled) return;

        setWalletUnreadCount(Math.max(0, Number(data?.count || 0)));
      } catch {
        return;
      }
    };

    intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncWalletUnread();
      }
    }, 900);

    const handleFocus = () => void syncWalletUnread();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncWalletUnread();
      }
    };

    void syncWalletUnread();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pathname]);

  const markWalletSeen = () => {
    if (walletUnreadCount <= 0) return;
    setWalletUnreadCount(0);
    void fetch("/api/wallet/notifications", {
      method: "POST",
      keepalive: true,
    }).catch(() => undefined);
  };

  const displayedProfileName = profileName || session?.user?.name || "NEXORA USER";

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
    const importantRoutes = [
      "/",
      "/market",
      "/market/deals",
      "/rewards",
      "/redeem",
      "/collections",
      "/community",
      "/wallet",
      "/dm",
      ownProfileHref,
      "/settings/profile",
    ];

    const warmCommunityFriends = async () => {
      if (!session?.user?.id) return;

      try {
        const res = await fetch("/api/community/friends", {
          cache: "no-store",
        });

        if (!res.ok) return;

        const data = await res.json().catch(() => ({}));
        const cached = readClientViewCache<{
          friends?: unknown[];
          requests?: unknown[];
          results?: unknown[];
          friendsLoadedAt?: number;
          resultsLoadedAt?: number;
        }>("community-hub", { maxAgeMs: 180000 })?.data;

        writeClientViewCache("community-hub", {
          friends: Array.isArray(data?.friends) ? data.friends : [],
          requests: Array.isArray(data?.requests) ? data.requests : [],
          results: Array.isArray(cached?.results) ? cached.results : [],
          friendsLoadedAt: Date.now(),
          resultsLoadedAt: cached?.resultsLoadedAt,
        });
      } catch {
        return;
      }
    };

    const warmRoutes = () => {
      importantRoutes.forEach((route) => router.prefetch(route));
      void warmCommunityFriends();
    };

    if (typeof window === "undefined") return;

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(() => warmRoutes(), {
        timeout: 1200,
      });

      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(warmRoutes, 250);
    return () => globalThis.clearTimeout(timeoutId);
  }, [ownProfileHref, router, session?.user?.id]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  const pageContext = useMemo(() => {
    if (pathname.startsWith("/market")) return t("layout.page.market");
    if (pathname.startsWith("/collections")) return t("layout.page.collections");
    if (pathname.startsWith("/community")) return t("layout.page.community");
    if (pathname.startsWith("/redeem")) return t("layout.page.redeem");
    if (pathname.startsWith("/rewards")) return t("layout.page.rewards");
    if (pathname.startsWith("/wallet")) return t("layout.page.wallet");
    if (pathname.startsWith("/dashboard")) return t("layout.page.dashboard");
    return t("layout.page.home");
  }, [pathname, t]);

  const sideItems = useMemo(
    () => [
      { href: "/", label: t("layout.nav.home"), icon: House, active: pathname === "/" },
      {
        href: "/market",
        label: t("layout.nav.market"),
        icon: ShoppingBag,
        active: pathname.startsWith("/market"),
      },
      {
        href: "/rewards",
        label: t("layout.nav.rewards"),
        icon: Trophy,
        active: pathname.startsWith("/rewards"),
      },
      {
        href: "/redeem",
        label: t("layout.nav.redeem"),
        icon: Gift,
        active: pathname.startsWith("/redeem"),
      },
      {
        href: "/collections",
        label: t("layout.nav.collections"),
        icon: FolderKanban,
        active: pathname.startsWith("/collections"),
      },
      {
        href: "/community",
        label: t("layout.nav.community"),
        icon: Cat,
        active: pathname.startsWith("/community"),
      },
      {
       href: "/dm",
       label: t("layout.nav.chat"),
       icon: MessageCircle,
       active: pathname.startsWith("/dm"),
      },
    ],
    [pathname, t]
  );

  const mobileBottomItems = useMemo(
    () => [
      { href: "/", label: t("layout.nav.home"), icon: House, active: pathname === "/" },
      {
        href: "/market",
        label: t("layout.nav.market"),
        icon: ShoppingBag,
        active: pathname.startsWith("/market"),
      },
      {
        href: "/wallet",
        label: t("layout.nav.wallet"),
        icon: Wallet,
        active: pathname.startsWith("/wallet"),
      },
      {
        href: "/community",
        label: t("layout.nav.community"),
        icon: Cat,
        active: pathname.startsWith("/community"),
      },
      {
        href: "/dm",
        label: t("layout.nav.chat"),
        icon: MessageCircle,
        active: pathname.startsWith("/dm"),
      },
      {
        href: ownProfileHref,
        label: "ฉัน",
        icon: User,
        active: pathname.startsWith("/profile"),
      },
    ],
    [ownProfileHref, pathname, t]
  );

  const drawerLinks = [
    ...sideItems,
    {
      href: "/wallet",
      label: t("layout.nav.wallet"),
      icon: Wallet,
      active: pathname.startsWith("/wallet"),
    },
    {
      href: ownProfileHref,
      label: t("layout.nav.profile"),
      icon: User,
      active: pathname.startsWith("/profile"),
    },
    {
      href: "/settings/profile",
      label: t("layout.nav.profileSettings"),
      icon: Settings,
      active: pathname.startsWith("/settings/profile"),
    },
  ];

  const handleGoBack = () => {
    setMenuOpen(false);
    setMobileNavOpen(false);

    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }

    router.push("/");
  };

  return (
    <div className="min-h-[var(--app-shell-height)] bg-[#050608] text-white">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.08),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.06),transparent_24%)]" />

      <div className="relative flex min-h-[var(--app-shell-height)]">
        {/* DESKTOP LEFT DOCK */}
        <aside className="fixed left-0 top-0 z-[600] hidden h-[var(--app-shell-height)] w-[92px] min-w-[92px] border-r border-white/5 bg-[#0a0b0e]/95 xl:flex xl:flex-col xl:items-center">
          <div className="flex h-full w-full flex-col items-center py-5">
            <PrefetchLink
              href="/"
              className="mb-6 flex h-14 w-14 items-center justify-center rounded-[20px] border border-amber-300/15 bg-[#12141a] text-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.18)] transition hover:scale-[1.03] hover:shadow-[0_0_34px_rgba(251,191,36,0.26)]"
            >
              <Gem className="h-5 w-5" />
            </PrefetchLink>

            <div className="flex flex-col gap-3">
              {sideItems.map((item) => {
                const Icon = item.icon;

                return (
                  <PrefetchLink
                    key={item.href}
                    href={item.href}
                    className={`group relative flex h-12 w-12 items-center justify-center rounded-2xl border transition ${
                      item.active
                        ? "border-amber-300/20 bg-amber-300/12 text-amber-300 shadow-[0_0_22px_rgba(251,191,36,0.18)]"
                        : "border-white/5 bg-white/[0.02] text-white/45 hover:border-amber-300/10 hover:bg-amber-300/[0.06] hover:text-amber-200 hover:shadow-[0_0_18px_rgba(251,191,36,0.10)]"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {item.href === "/dm" && chatUnreadCount > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 min-w-[20px] rounded-full border border-red-300/40 bg-[radial-gradient(circle_at_top,#ff7b7b,#ef4444_60%,#b91c1c)] px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white shadow-[0_0_20px_rgba(239,68,68,0.45)]">
                        {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                      </span>
                    )}
                  </PrefetchLink>
                );
              })}
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <div className="relative z-0 flex min-w-0 flex-1 flex-col xl:ml-[92px]">
          {/* TOPBAR */}
          <header className="sticky top-0 z-[500] border-b border-white/5 bg-[#0b0c10]/88 backdrop-blur-2xl">
            <div className="flex h-[74px] items-center justify-between gap-2 px-3 sm:px-5 xl:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleGoBack}
                  aria-label="ย้อนกลับ"
                  title="ย้อนกลับ"
                  className="group relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-amber-200/35 bg-[linear-gradient(135deg,#fde68a_0%,#f59e0b_54%,#92400e_100%)] text-black shadow-[0_10px_26px_rgba(245,158,11,0.28),inset_0_1px_0_rgba(255,255,255,0.55)] transition hover:scale-[1.03] hover:shadow-[0_12px_30px_rgba(245,158,11,0.38),0_0_22px_rgba(251,191,36,0.22)] active:scale-95 sm:h-12 sm:w-12 xl:h-11 xl:w-11 2xl:w-auto 2xl:gap-2 2xl:px-4"
                >
                  <span className="pointer-events-none absolute inset-x-2 top-0 h-px bg-white/70" />
                  <ArrowLeft className="relative h-5 w-5 stroke-[2.8] sm:h-[22px] sm:w-[22px] xl:h-5 xl:w-5" />
                  <span className="relative hidden text-sm font-black 2xl:inline">
                    ย้อนกลับ
                  </span>
                </button>

                {/* MOBILE LOGO */}
                <PrefetchLink
                  href="/"
                  className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/15 bg-[#12141a] text-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.16)] sm:flex xl:hidden"
                >
                  <Gem className="h-5 w-5" />
                </PrefetchLink>

                <div className="min-w-0 max-[430px]:max-w-[108px]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35 max-[430px]:hidden sm:text-[11px]">
                    {t("layout.command")}
                  </div>
                  <div className="line-clamp-2 text-base font-black leading-[1.05] sm:text-2xl sm:leading-none">
                    {pageContext}
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3">
                <NotificationBell />

                <PrefetchLink
                  href="/wallet"
                  onClick={markWalletSeen}
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-amber-300 transition hover:bg-white/[0.06] hover:shadow-[0_0_18px_rgba(251,191,36,0.14)]"
                >
                  <Wallet className="h-4 w-4" />
                  {walletUnreadCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 min-w-[20px] rounded-full border border-red-300/40 bg-[radial-gradient(circle_at_top,#ff7b7b,#ef4444_60%,#b91c1c)] px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white shadow-[0_0_20px_rgba(239,68,68,0.45)]">
                      {walletUnreadCount > 99 ? "99+" : walletUnreadCount}
                    </span>
                  )}
                </PrefetchLink>

                <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                  <div className="w-[110px] shrink-0 rounded-[13px] border border-white/10 bg-[#121418] px-1.5 py-1.5 text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] sm:hidden">
                    <div className="flex min-w-0 items-center justify-between gap-1">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[8px] bg-white/[0.06] text-white">
                        <Gem className="h-[10px] w-[10px]" />
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-[10px] font-black leading-none text-white">
                        {formatBalance(liveBalances.nexPoint)}
                      </div>
                      <div className="shrink-0 text-[6.5px] font-bold uppercase tracking-[0.1em] text-white/62">
                        NEX
                      </div>
                    </div>

                    <div className="mt-1 border-t border-white/8 pt-1">
                      <div className="flex min-w-0 items-center justify-between gap-1">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[8px] bg-white/[0.06] text-white">
                          <Coins className="h-[10px] w-[10px]" />
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-[10px] font-black leading-none text-white">
                          {formatBalance(liveBalances.coin)}
                        </div>
                        <div className="shrink-0 text-[6.5px] font-bold uppercase tracking-[0.1em] text-white/62">
                          COIN
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="hidden min-w-0 items-center gap-1.5 sm:flex sm:gap-2">
                    <div className="flex min-w-0 items-center gap-2 rounded-[16px] border border-white/10 bg-[#121418] px-2.5 py-2 text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] sm:px-3.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white sm:h-8 sm:w-8">
                        <Gem className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-black leading-none text-white sm:text-[16px]">
                          {formatBalance(liveBalances.nexPoint)}
                        </div>
                        <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.22em] text-white/58 sm:text-[10px]">
                          NEX
                        </div>
                      </div>
                    </div>

                    <div className="flex min-w-0 items-center gap-2 rounded-[16px] border border-white/10 bg-[#121418] px-2.5 py-2 text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] sm:px-3.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white sm:h-8 sm:w-8">
                        <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-black leading-none text-white sm:text-[16px]">
                          {formatBalance(liveBalances.coin)}
                        </div>
                        <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.22em] text-white/58 sm:text-[10px]">
                          COIN
                        </div>
                      </div>
                    </div>
                  </div>
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
                      <Image
                        src={profileImage}
                        alt="profile"
                        fill
                        sizes="40px"
                        priority
                        quality={100}
                        unoptimized
                        draggable={false}
                        onLoad={() => setAvatarReady(true)}
                        className={`absolute inset-0 object-cover transition-opacity duration-300 ease-out ${
                          avatarReady ? "opacity-100" : "opacity-0"
                        }`}
                        onError={() => {
                          if (profileImage !== "/avatar.png") {
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
                          {t("layout.profile.commander")}
                        </div>
                        <div className="mt-1 truncate text-base font-black text-white">
                          {displayedProfileName}
                        </div>
                      </div>

                      <PrefetchLink
                        href="/wallet"
                        onClick={() => {
                          markWalletSeen();
                          setMenuOpen(false);
                        }}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/85 transition hover:bg-amber-300/[0.06]"
                      >
                        <span className="relative">
                          <Wallet className="h-4 w-4 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
                          {walletUnreadCount > 0 && (
                            <span className="absolute -right-2 -top-2 h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_14px_rgba(248,113,113,0.75)]" />
                          )}
                        </span>
                        {t("layout.nav.wallet")}
                      </PrefetchLink>

                      <PrefetchLink
                        href={
                          session?.user?.id
                            ? `/profile/${session.user.id}`
                            : "/profile/me"
                        }
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/85 transition hover:bg-amber-300/[0.06]"
                      >
                        <User className="h-4 w-4 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
                        {t("layout.nav.profile")}
                      </PrefetchLink>

                      <PrefetchLink
                        href="/settings/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/85 transition hover:bg-amber-300/[0.06]"
                      >
                        <Settings className="h-4 w-4 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
                        {t("layout.nav.profileSettings")}
                      </PrefetchLink>

                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          signOut({ callbackUrl: "/login" });
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-red-300 transition hover:bg-red-500/10"
                      >
                        <LogOut className="h-4 w-4" />
                        {t("layout.logout")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* CONTENT */}
          <main
            className={`relative z-0 min-w-0 flex-1 bg-[#07080b] ${
              isChatRoomPage
                ? "overflow-hidden p-0 pb-0"
                : "p-3 pb-[calc(env(safe-area-inset-bottom)+90px)] sm:p-4 sm:pb-[calc(env(safe-area-inset-bottom)+100px)] xl:p-6 xl:pb-6"
            }`}
          >
            <div
              className={`${
                isChatRoomPage
                  ? "h-[calc(var(--app-shell-height)-var(--app-header-height))] min-h-0 overflow-hidden border-0 bg-transparent p-0 shadow-none"
                  : "min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] rounded-[24px] border border-white/5 bg-[linear-gradient(180deg,#0b0d10_0%,#090a0d_100%)] p-3 shadow-[0_20px_80px_rgba(0,0,0,0.28)] sm:min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height-sm))] sm:rounded-[26px] sm:p-4 xl:min-h-[calc(var(--app-shell-height)-var(--app-desktop-chrome-height))] xl:p-6"
              }`}
            >
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
                <div className="text-lg font-black">{t("layout.mobile.menu")}</div>
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
                  <Image
                    src={profileImage}
                    alt="profile"
                    fill
                    sizes="56px"
                    draggable={false}
                    className="object-cover"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-black">
                  {displayedProfileName}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#121418] px-3 py-1.5 text-xs font-black text-white">
                    <Gem className="h-3.5 w-3.5 text-white/80" />
                    {formatBalance(liveBalances.nexPoint)} NEX
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#121418] px-3 py-1.5 text-xs font-black text-white">
                    <Coins className="h-3.5 w-3.5 text-white/80" />
                    {formatBalance(liveBalances.coin)} COIN
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {drawerLinks.map((item) => {
              const Icon = item.icon;

              return (
                <PrefetchLink
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (item.href === "/wallet") {
                      markWalletSeen();
                    }
                    setMobileNavOpen(false);
                  }}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-4 transition ${
                    item.active
                      ? "border-amber-300/18 bg-amber-300/10 text-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.10)]"
                      : "border-white/5 bg-white/[0.02] text-white/85 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${
                        item.active
                          ? "bg-amber-300/12 text-amber-300"
                          : "bg-white/[0.04] text-white/65"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {item.href === "/dm" && chatUnreadCount > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 min-w-[19px] rounded-full border border-red-300/40 bg-[radial-gradient(circle_at_top,#ff7b7b,#ef4444_60%,#b91c1c)] px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white shadow-[0_0_20px_rgba(239,68,68,0.45)]">
                          {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                        </span>
                      )}
                      {item.href === "/wallet" && walletUnreadCount > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 min-w-[19px] rounded-full border border-red-300/40 bg-[radial-gradient(circle_at_top,#ff7b7b,#ef4444_60%,#b91c1c)] px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white shadow-[0_0_20px_rgba(239,68,68,0.45)]">
                          {walletUnreadCount > 99 ? "99+" : walletUnreadCount}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold">{item.label}</span>
                  </div>

                  <ChevronRight className="h-4 w-4 opacity-50" />
                </PrefetchLink>
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
                <span className="text-sm font-bold">{t("layout.logout")}</span>
              </div>
              <ChevronRight className="h-4 w-4 opacity-50" />
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM NAV */}
      {!isChatRoomPage && (
        <nav className="fixed bottom-[12px] left-0 right-0 z-[1100] mx-auto max-w-[640px] overflow-hidden rounded-[26px] border border-white/10 bg-[#0b0c10]/82 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-10px_40px_rgba(0,0,0,0.6)] backdrop-blur-3xl xl:hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.08),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
          <div className="mx-auto grid max-w-[640px] grid-cols-6 gap-1.5 sm:gap-2">
            {mobileBottomItems.map((item) => {
              const Icon = item.icon;

              return (
                <PrefetchLink
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={`relative flex min-h-[64px] flex-col items-center justify-center overflow-hidden rounded-[20px] border px-1 transition-all duration-200 ${
                    item.active
                      ? "border-amber-300/20 bg-[linear-gradient(180deg,rgba(251,191,36,0.14),rgba(251,191,36,0.06))] text-amber-300 shadow-[0_0_22px_rgba(251,191,36,0.12)]"
                      : "border-transparent bg-white/[0.02] text-white/45 hover:bg-white/[0.04]"
                  }`}
                >
                  {item.active && (
                    <span className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
                  )}
                  <Icon className="h-5 w-5" />
                  {item.href === "/dm" && chatUnreadCount > 0 && (
                    <span className="absolute right-2 top-2 min-w-[19px] rounded-full border border-red-300/40 bg-[radial-gradient(circle_at_top,#ff7b7b,#ef4444_60%,#b91c1c)] px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white shadow-[0_0_20px_rgba(239,68,68,0.45)]">
                      {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                    </span>
                  )}
                  <span className="mt-1 text-[10px] font-bold leading-none sm:text-[11px]">
                    {item.label}
                  </span>
                </PrefetchLink>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
