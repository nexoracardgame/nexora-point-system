"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Clock3,
  Handshake,
  Shield,
  Store,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import SafeCardImage from "@/components/SafeCardImage";
import { useLanguage } from "@/lib/i18n";
import {
  emitDealSync,
  listenDealServerSync,
  listenDealSync,
} from "@/lib/deal-sync";
import {
  readClientViewCache,
  writeClientViewCache,
} from "@/lib/client-view-cache";
import MarketFeatureNav from "@/components/MarketFeatureNav";
import { prefetchDealChatRoom } from "@/lib/chat-room-prefetch";
import type { DealCard } from "@/lib/market-deals";
import CancelDealButton from "./CancelDealButton";
import DealActionButtons from "./DealActionButtons";
import VerifySaleButton from "./VerifySaleButton";

function safeImage(src?: string | null, fallback = "/avatar.png") {
  const raw = String(src || "").trim();
  return raw || fallback;
}

function buildDealChatHref(dealId: string) {
  return `/market/deals/chat/${encodeURIComponent(dealId)}`;
}

function getStatusUI(
  status: string,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  switch (status) {
    case "accepted":
      return {
        label: t("deals.status.ready"),
        className: "border-black bg-black text-white shadow-[0_10px_28px_rgba(0,0,0,0.18)]",
        icon: BadgeCheck,
      };
    case "rejected":
      return {
        label: t("deals.status.rejected"),
        className: "border-red-500/20 bg-red-100 text-red-950",
        icon: XCircle,
      };
    default:
      return {
        label: t("deals.status.pending"),
        className: "border-amber-500/25 bg-amber-100 text-amber-950",
        icon: Clock3,
      };
  }
}

export default function DealsClient({
  initialDeals,
}: {
  initialDeals: DealCard[];
}) {
  const cachedDeals = useMemo(
    () =>
      readClientViewCache<DealCard[]>("deal-center", {
        maxAgeMs: 180000,
      }),
    []
  );
  const router = useRouter();
  const { t } = useLanguage();
  const [deals, setDeals] = useState<DealCard[]>(
    initialDeals.length > 0 ? initialDeals : cachedDeals?.data || []
  );
  const [creatingChatId, setCreatingChatId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(initialDeals.length === 0 && !cachedDeals?.data?.length);
  const [hiddenDealIds, setHiddenDealIds] = useState<string[]>([]);
  const lastOptimisticMutationAt = useRef(0);
  const hiddenDealIdsRef = useRef<Set<string>>(new Set());
  const requestIdRef = useRef(0);
  const dealsRef = useRef<DealCard[]>(initialDeals);

  const sortDeals = useCallback((items: DealCard[]) => {
    return [...items].sort((a, b) => {
      const statusRank = (status: DealCard["status"]) => {
        switch (status) {
          case "accepted":
            return 0;
          case "pending":
            return 1;
          default:
            return 2;
        }
      };

      const rankDiff = statusRank(a.status) - statusRank(b.status);
      if (rankDiff !== 0) {
        return rankDiff;
      }

      const createdAtDiff =
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }

      return a.id.localeCompare(b.id);
    });
  }, []);

  useEffect(() => {
    dealsRef.current = deals;
  }, [deals]);

  useEffect(() => {
    if (initialDeals.length === 0) {
      return;
    }

    setDeals(
      sortDeals(
        initialDeals.filter(
          (deal) => !hiddenDealIdsRef.current.has(String(deal.id || ""))
        )
      )
    );
  }, [initialDeals, sortDeals]);

  useEffect(() => {
    if (initialDeals.length > 0 || dealsRef.current.length > 0) {
      return;
    }

    const cached = readClientViewCache<DealCard[]>("deal-center", {
      maxAgeMs: 180000,
    });

    if (!cached?.data?.length) {
      return;
    }

    setDeals(sortDeals(cached.data));
    setRefreshing(false);
  }, [initialDeals.length, sortDeals]);

  useEffect(() => {
    if (deals.length === 0) {
      return;
    }

    writeClientViewCache("deal-center", deals);
  }, [deals]);

  const fetchDeals = useCallback(async (preserveOnEmpty = true) => {
    const requestId = ++requestIdRef.current;

    try {
      setRefreshing(true);

      const res = await fetch("/api/market/deals", {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!res.ok) {
        throw new Error(String(data?.error || t("deals.loading")));
      }

      if (Date.now() - lastOptimisticMutationAt.current < 1800) {
        return;
      }

      const nextDeals = Array.isArray(data) ? data : [];

      if (
        preserveOnEmpty &&
        nextDeals.length === 0 &&
        dealsRef.current.length > 0
      ) {
        return;
      }

      setDeals(
        sortDeals(
          nextDeals.filter(
            (deal) => !hiddenDealIdsRef.current.has(String(deal.id || ""))
          )
        )
      );
    } catch (error) {
      console.error("FETCH DEALS ERROR:", error);
    } finally {
      if (requestId === requestIdRef.current) {
        setRefreshing(false);
      }
    }
  }, [sortDeals, t]);

  useEffect(() => {
    const onFocus = () => {
      void fetchDeals(true);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchDeals(true);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchDeals(true);
      }
    }, 15000);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [fetchDeals]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void fetchDeals(true);
    }, initialDeals.length > 0 || cachedDeals?.data?.length ? 80 : 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [cachedDeals?.data?.length, fetchDeals, initialDeals.length]);

  useEffect(() => {
    return listenDealSync(() => {
      void fetchDeals(false);
    });
  }, [fetchDeals]);

  useEffect(() => {
    return listenDealServerSync(() => {
      void fetchDeals(false);
    });
  }, [fetchDeals]);

  const warmDealChat = useCallback((dealId: string) => {
    if (!dealId) return;

    router.prefetch(buildDealChatHref(dealId));
    void prefetchDealChatRoom(dealId).catch(() => null);
  }, [router]);

  const handleChat = (dealId: string) => {
    if (!dealId || creatingChatId) return;

    setCreatingChatId(dealId);
    warmDealChat(dealId);
    router.push(buildDealChatHref(dealId));
  };

  const optimisticallyRemoveDeal = useCallback((dealId: string) => {
    let removedDeal: DealCard | null = null;

    setDeals((prev) => {
      removedDeal = prev.find((deal) => deal.id === dealId) || null;
      if (!removedDeal) {
        return prev;
      }

      lastOptimisticMutationAt.current = Date.now();
      return prev.filter((deal) => deal.id !== dealId);
    });

    hiddenDealIdsRef.current.add(dealId);
    setHiddenDealIds((prev) =>
      prev.includes(dealId) ? prev : [...prev, dealId]
    );

    return () => {
      if (!removedDeal) return;

      hiddenDealIdsRef.current.delete(dealId);
      setHiddenDealIds((prev) => prev.filter((id) => id !== dealId));
      setDeals((prev) => {
        if (prev.some((deal) => deal.id === removedDeal?.id)) {
          return prev;
        }

        return sortDeals([removedDeal as DealCard, ...prev]);
      });
    };
  }, [sortDeals]);

  const optimisticallyAcceptDeal = useCallback((dealId: string) => {
    setDeals((prev) => {
      lastOptimisticMutationAt.current = Date.now();
      return sortDeals(
        prev.map((deal) =>
          deal.id === dealId
            ? {
                ...deal,
                status: "accepted",
              }
            : deal
        )
      );
    });
  }, [sortDeals]);

  const optimisticallyRejectDeal = useCallback(
    (dealId: string) => {
      const rollback = optimisticallyRemoveDeal(dealId);
      emitDealSync({
        dealId,
        action: "rejected",
      });
      return rollback;
    },
    [optimisticallyRemoveDeal]
  );

  const visibleDeals = useMemo(
    () =>
      sortDeals(
        deals.filter((deal) => !hiddenDealIds.includes(String(deal.id || "")))
      ),
    [deals, hiddenDealIds, sortDeals]
  );

  const pendingDeals = useMemo(
    () => visibleDeals.filter((deal) => deal.status === "pending"),
    [visibleDeals]
  );

  const acceptedDeals = useMemo(
    () => visibleDeals.filter((deal) => deal.status === "accepted"),
    [visibleDeals]
  );

  const renderDealCard = (deal: DealCard, index: number) => {
    const statusUI = getStatusUI(deal.status, t);
    const StatusIcon = statusUI.icon;
    const member = deal.isSeller ? deal.buyer : deal.seller;
    const isOpeningChat = creatingChatId === deal.id;
    const canOpenChat = deal.status === "accepted";

    return (
      <div
        key={deal.id}
        className="rounded-[30px] border border-black/8 bg-white p-4 text-black shadow-[0_22px_70px_rgba(10,10,14,0.12)] ring-1 ring-white/70 transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_86px_rgba(10,10,14,0.16)] sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                deal.isSeller
                  ? "bg-black text-amber-200"
                  : "bg-[#f3eee9] text-black"
              }`}
            >
              {deal.isSeller ? (
                <Shield className="h-5 w-5" />
              ) : (
                <Handshake className="h-5 w-5" />
              )}
            </div>

            <div>
              <div className="text-[12px] font-black uppercase tracking-[0.12em] text-black/62">
                {deal.status === "accepted"
                  ? deal.isSeller
                    ? t("deals.role.waitBuyer")
                    : t("deals.role.verify")
                  : deal.isSeller
                    ? t("deals.role.ownerAction")
                    : t("deals.role.yourRequest")}
              </div>
              <div className="text-base font-black text-black">
                #{String(index + 1).padStart(3, "0")}
              </div>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] sm:text-xs ${statusUI.className}`}
          >
            <StatusIcon className="h-4 w-4" />
            {statusUI.label}
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-black/6 bg-[#f3eee9] p-4">
          <div className="flex items-center gap-2 text-sm font-black text-black/68">
            <Wallet className="h-4 w-4" />
            {t("deals.offerPrice")}
          </div>
          <div className="mt-2 text-2xl font-black text-black sm:text-3xl">
            ฿{Number(deal.offeredPrice).toLocaleString("th-TH")}
          </div>
        </div>

        {canOpenChat && (
          <button
            onClick={() => handleChat(deal.id)}
            onMouseEnter={() => warmDealChat(deal.id)}
            onTouchStart={() => warmDealChat(deal.id)}
            onFocus={() => warmDealChat(deal.id)}
            disabled={isOpeningChat}
            className="mt-3 w-full rounded-2xl bg-black py-3 text-sm font-black text-white shadow-[0_18px_42px_rgba(0,0,0,0.20)] transition hover:-translate-y-0.5 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isOpeningChat ? t("deals.chatOpening") : t("deals.chat")}
          </button>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-[24px] bg-[#f7f4f0] p-4 ring-1 ring-black/5">
            <div className="text-[12px] font-black uppercase tracking-[0.12em] text-black/58">
              {t("deals.card")}
            </div>

            <div className="mt-3 flex items-center gap-4">
              <div className="relative aspect-[2/3] w-20 overflow-hidden rounded-2xl border border-black/8 bg-black shadow-xl sm:w-24">
                <SafeCardImage
                  cardNo={deal.cardNo}
                  imageUrl={deal.cardImage}
                  alt={deal.cardName}
                  className="h-full w-full object-cover"
                  loading="eager"
                  fetchPriority="high"
                />
              </div>

              <div className="min-w-0">
                <div className="truncate text-base font-black text-black sm:text-lg">
                  {deal.cardName}
                </div>

                <div className="mt-2 text-sm font-black text-amber-600">
                  #{String(deal.cardNo).padStart(3, "0")}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] bg-[#f7f4f0] p-4 ring-1 ring-black/5">
            <div className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.12em] text-black/58">
              <User className="h-3.5 w-3.5" />
              {deal.isSeller ? t("deals.buyer") : t("deals.seller")}
            </div>

            <Link
              href={`/profile/${member.id}`}
              className="mt-3 flex items-center gap-3 rounded-2xl p-2 transition hover:bg-black/[0.04]"
            >
              <div className="relative h-12 w-12 overflow-hidden rounded-full border border-black/8 bg-white">
                <Image
                  src={safeImage(member.image, "/avatar.png")}
                  alt={member.name}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>

              <div className="truncate text-sm font-black text-black/80">
                {member.name}
              </div>
            </Link>
          </div>
        </div>

        <div
          className={`mt-4 rounded-[22px] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] ${
            deal.status === "accepted"
              ? "border-black/8 bg-[#edf8fb]"
              : deal.isSeller
                ? "border-black/8 bg-[#f4effc]"
                : "border-black/8 bg-[#fff1f2]"
          }`}
        >
          {deal.status === "pending" && deal.isSeller && (
            <>
              <div className="mb-3 text-[15px] font-black uppercase tracking-[0.08em] text-black drop-shadow-[0_1px_0_rgba(255,255,255,0.75)]">
                {t("deals.ownerAction")}
              </div>
              <DealActionButtons
                dealId={deal.id}
                onAccepted={() => {
                  optimisticallyAcceptDeal(deal.id);
                }}
                onRejected={() => {
                  optimisticallyRejectDeal(deal.id);
                }}
              />
            </>
          )}

          {deal.status === "pending" && !deal.isSeller && (
            <>
              <div className="mb-3 text-[15px] font-black uppercase tracking-[0.08em] text-black drop-shadow-[0_1px_0_rgba(255,255,255,0.75)]">
                {t("deals.activeRequest")}
              </div>
              <CancelDealButton
                dealId={deal.id}
                label={t("deals.cancelRequest")}
                onOptimisticCancel={() => optimisticallyRemoveDeal(deal.id)}
              />
            </>
          )}

          {deal.status === "accepted" && deal.isSeller && (
            <>
              <div className="mb-3 text-[15px] font-black uppercase tracking-[0.08em] text-black drop-shadow-[0_1px_0_rgba(255,255,255,0.75)]">
                {t("deals.acceptedWait")}
              </div>
              <div className="rounded-xl border border-black/8 bg-white px-4 py-3 text-sm font-bold leading-6 text-black/72 shadow-[0_8px_22px_rgba(0,0,0,0.06)]">
                {t("deals.acceptedDesc")}
              </div>
              <div className="mt-3">
                <CancelDealButton
                  dealId={deal.id}
                  label={t("deals.cancelAccepted")}
                  onOptimisticCancel={() => optimisticallyRemoveDeal(deal.id)}
                />
              </div>
            </>
          )}

          {deal.status === "accepted" && !deal.isSeller && (
            <>
              <div className="mb-3 text-[15px] font-black uppercase tracking-[0.08em] text-black drop-shadow-[0_1px_0_rgba(255,255,255,0.75)]">
                {t("deals.closeReady")}
              </div>
              <div className="space-y-3">
                <VerifySaleButton dealId={deal.id} />
                <CancelDealButton
                  dealId={deal.id}
                  label={t("deals.cancelAccepted")}
                  onOptimisticCancel={() => optimisticallyRemoveDeal(deal.id)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(251,191,36,0.13),transparent_26%),radial-gradient(circle_at_0%_42%,rgba(124,58,237,0.13),transparent_24%),radial-gradient(circle_at_100%_74%,rgba(34,211,238,0.08),transparent_26%),linear-gradient(180deg,#0b0b10_0%,#050507_100%)]" />

      <div className="relative mx-auto max-w-7xl space-y-5 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6">
        <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,18,48,0.98),rgba(11,12,18,0.92))] p-4 shadow-[0_25px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:rounded-[36px] sm:p-6 xl:p-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_35%),radial-gradient(circle_at_top_left,rgba(168,85,247,0.2),transparent_32%)]" />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-violet-200 sm:text-xs">
                <Handshake className="h-3.5 w-3.5" />
                NEXORA DEAL CENTER
              </div>

              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl xl:text-5xl">
                {t("deals.title")}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60 sm:text-base sm:leading-7">
                ดูคำขอดีลล่าสุดของคุณแบบพร้อมใช้งานทันที เลือกรับข้อเสนอ
                คุยต่อในห้องดีล และปิดการขายได้จากหน้าเดียวแบบลื่นทั้งมือถือและคอม
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
              <div className="rounded-[24px] border border-amber-300/15 bg-amber-300/10 p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                  {t("deals.pending")}
                </div>
                <div className="mt-2 text-2xl font-black text-amber-300 sm:text-3xl">
                  {pendingDeals.length}
                </div>
              </div>

              <div className="rounded-[24px] border border-cyan-300/15 bg-cyan-300/10 p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                  {t("deals.ready")}
                </div>
                <div className="mt-2 text-2xl font-black text-cyan-300 sm:text-3xl">
                  {acceptedDeals.length}
                </div>
              </div>
            </div>
          </div>

          <div className="relative mt-4 text-sm font-bold text-white/48">
            {refreshing ? t("deals.refreshing") : t("deals.autoRefresh")}
          </div>
        </section>

        <MarketFeatureNav />

        {acceptedDeals.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-black">
                <Store className="h-5 w-5" />
              </div>
              <div className="text-2xl font-black text-white">
                {t("deals.section.ready")}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {acceptedDeals.map((deal, index) => renderDealCard(deal, index))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-black">
              <Clock3 className="h-5 w-5" />
            </div>
            <div className="text-2xl font-black text-white">
              {t("deals.section.pending")}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pendingDeals.length > 0 ? (
              pendingDeals.map((deal, index) => renderDealCard(deal, index))
            ) : (
              <div className="rounded-[30px] border border-white/10 bg-white p-10 text-center text-sm font-black text-black/45 shadow-[0_22px_70px_rgba(10,10,14,0.12)] lg:col-span-2">
                {t("deals.empty")}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
