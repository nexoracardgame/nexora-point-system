"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Clock3,
  Handshake,
  Shield,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import CancelDealButton from "./CancelDealButton";
import DealActionButtons from "./DealActionButtons";
import VerifySaleButton from "./VerifySaleButton";

type DealMember = {
  id: string;
  name: string;
  image: string;
};

type DealCard = {
  id: string;
  status: "pending" | "accepted" | "rejected" | "completed";
  offeredPrice: number;
  isSeller: boolean;
  buyer: DealMember;
  seller: DealMember;
  cardName: string;
  cardNo: string;
  cardImage: string;
  listingStatus: string;
};

function safeImage(src?: string | null, fallback = "/avatar.png") {
  const raw = String(src || "").trim();
  return raw || fallback;
}

function getStatusUI(
  status: string,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  switch (status) {
    case "accepted":
      return {
        label: t("deals.status.ready"),
        className: "border-cyan-300/20 bg-cyan-400/10 text-cyan-300",
        icon: BadgeCheck,
      };
    case "rejected":
      return {
        label: t("deals.status.rejected"),
        className: "border-red-300/20 bg-red-400/10 text-red-300",
        icon: XCircle,
      };
    default:
      return {
        label: t("deals.status.pending"),
        className: "border-amber-300/20 bg-amber-300/10 text-amber-300",
        icon: Clock3,
      };
  }
}

export default function DealsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [deals, setDeals] = useState<DealCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingChatId, setCreatingChatId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeals = useCallback(async (firstLoad = false) => {
    try {
      if (firstLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const res = await fetch("/api/market/deals", {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(t("deals.loading"));
      }

      const data = await res.json();
      setDeals(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("FETCH DEALS ERROR:", error);
      if (firstLoad) {
        setDeals([]);
      }
    } finally {
      if (firstLoad) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, [t]);

  useEffect(() => {
    const start = window.setTimeout(() => {
      void fetchDeals(true);
    }, 0);

    const onFocus = () => {
      void fetchDeals(false);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchDeals(false);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchDeals(false);
      }
    }, 15000);

    return () => {
      window.clearTimeout(start);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [fetchDeals]);

  const handleChat = async (dealId: string) => {
    if (!dealId || creatingChatId) return;

    setCreatingChatId(dealId);
    router.push(`/market/deals/chat/${dealId}`);
  };

  const pendingDeals = useMemo(
    () => deals.filter((deal) => deal.status === "pending"),
    [deals]
  );

  const acceptedDeals = useMemo(
    () => deals.filter((deal) => deal.status === "accepted"),
    [deals]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#22114a_0%,#090b12_40%,#05070d_100%)] text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 text-zinc-300 shadow-[0_25px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            {t("deals.loading")}
          </div>
        </div>
      </div>
    );
  }

  const renderDealCard = (deal: DealCard, index: number) => {
    const statusUI = getStatusUI(deal.status, t);
    const StatusIcon = statusUI.icon;
    const member = deal.isSeller ? deal.buyer : deal.seller;
    const isOpeningChat = creatingChatId === deal.id;
    const canOpenChat = deal.status === "accepted";

    return (
      <div
        key={deal.id}
        className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                deal.isSeller
                  ? "bg-violet-500/10 text-violet-300"
                  : "bg-red-500/10 text-red-300"
              }`}
            >
              {deal.isSeller ? (
                <Shield className="h-5 w-5" />
              ) : (
                <Handshake className="h-5 w-5" />
              )}
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                {deal.status === "accepted"
                  ? deal.isSeller
                    ? t("deals.role.waitBuyer")
                    : t("deals.role.verify")
                  : deal.isSeller
                    ? t("deals.role.ownerAction")
                    : t("deals.role.yourRequest")}
              </div>
              <div className="text-sm font-bold text-white/85">
                #{String(index + 1).padStart(3, "0")}
              </div>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${statusUI.className}`}
          >
            <StatusIcon className="h-4 w-4" />
            {statusUI.label}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Wallet className="h-4 w-4" />
            {t("deals.offerPrice")}
          </div>
          <div className="mt-2 text-2xl font-black text-amber-300 sm:text-3xl">
            ฿{Number(deal.offeredPrice).toLocaleString("th-TH")}
          </div>
        </div>

        {canOpenChat && (
          <button
            onClick={() => handleChat(deal.id)}
            disabled={isOpeningChat}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-yellow-300 to-yellow-500 py-3 text-sm font-black text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isOpeningChat ? t("deals.chatOpening") : t("deals.chat")}
          </button>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-white/[0.03] p-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              {t("deals.card")}
            </div>

            <div className="mt-3 flex items-center gap-4">
              <img
                src={safeImage(deal.cardImage, "/cards/001.jpg")}
                alt={deal.cardName}
                className="aspect-[2/3] w-20 rounded-2xl border border-white/10 object-cover shadow-xl sm:w-24"
                onError={(e) => {
                  e.currentTarget.src = "/cards/001.jpg";
                }}
              />

              <div className="min-w-0">
                <div className="truncate text-base font-black text-white/90 sm:text-lg">
                  {deal.cardName}
                </div>

                <div className="mt-2 text-sm text-amber-300">
                  #{String(deal.cardNo).padStart(3, "0")}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <User className="h-3.5 w-3.5" />
              {deal.isSeller ? t("deals.buyer") : t("deals.seller")}
            </div>

            <Link
              href={`/profile/${member.id}`}
              className="mt-3 flex items-center gap-3 rounded-2xl p-2 transition hover:bg-white/[0.04]"
            >
              <img
                src={safeImage(member.image, "/avatar.png")}
                alt={member.name}
                className="h-12 w-12 rounded-full border border-white/10 object-cover"
                onError={(e) => {
                  e.currentTarget.src = "/avatar.png";
                }}
              />

              <div className="truncate text-sm font-bold text-white/85">
                {member.name}
              </div>
            </Link>
          </div>
        </div>

        <div
          className={`mt-4 rounded-2xl border p-3 ${
            deal.status === "accepted"
              ? "border-cyan-400/15 bg-cyan-500/5"
              : deal.isSeller
                ? "border-violet-400/15 bg-violet-500/5"
                : "border-red-400/15 bg-red-500/5"
          }`}
        >
          {deal.status === "pending" && deal.isSeller && (
            <>
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
                {t("deals.ownerAction")}
              </div>
              <DealActionButtons dealId={deal.id} />
            </>
          )}

          {deal.status === "pending" && !deal.isSeller && (
            <>
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-red-300">
                {t("deals.activeRequest")}
              </div>
              <CancelDealButton dealId={deal.id} label={t("deals.cancelRequest")} />
            </>
          )}

          {deal.status === "accepted" && deal.isSeller && (
            <>
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
                {t("deals.acceptedWait")}
              </div>
              <div className="rounded-xl border border-cyan-300/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                {t("deals.acceptedDesc")}
              </div>
              <div className="mt-3">
                <CancelDealButton
                  dealId={deal.id}
                  label={t("deals.cancelAccepted")}
                />
              </div>
            </>
          )}

          {deal.status === "accepted" && !deal.isSeller && (
            <>
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
                {t("deals.closeReady")}
              </div>
              <div className="space-y-3">
                <VerifySaleButton dealId={deal.id} />
                <CancelDealButton
                  dealId={deal.id}
                  label={t("deals.cancelAccepted")}
                />
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#22114a_0%,#090b12_40%,#05070d_100%)] text-white">
      <div className="relative mx-auto max-w-7xl space-y-5 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6">
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_25px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:rounded-[40px] sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-violet-300 sm:text-xs">
                NEXORA DEAL CENTER
              </div>
              <h1 className="mt-2 text-2xl font-black sm:text-5xl">
                {t("deals.title")}
              </h1>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-amber-300/15 bg-amber-300/10 p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                  {t("deals.pending")}
                </div>
                <div className="mt-2 text-2xl font-black text-amber-300 sm:text-3xl">
                  {pendingDeals.length}
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/10 p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                  {t("deals.ready")}
                </div>
                <div className="mt-2 text-2xl font-black text-cyan-300 sm:text-3xl">
                  {acceptedDeals.length}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-white/35">
            {refreshing ? t("deals.refreshing") : t("deals.autoRefresh")}
          </div>
        </section>

        {acceptedDeals.length > 0 && (
          <section>
            <div className="mb-4 text-2xl font-black text-cyan-300">
              {t("deals.section.ready")}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {acceptedDeals.map((deal, index) => renderDealCard(deal, index))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-4 text-2xl font-black text-amber-300">
            {t("deals.section.pending")}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pendingDeals.length > 0 ? (
              pendingDeals.map((deal, index) => renderDealCard(deal, index))
            ) : (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-10 text-center text-zinc-400 lg:col-span-2">
                {t("deals.empty")}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
