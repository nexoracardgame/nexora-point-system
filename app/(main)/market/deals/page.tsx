"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DealActionButtons from "./DealActionButtons";
import CancelDealButton from "./CancelDealButton";
import VerifySaleButton from "./VerifySaleButton";
import {
  Handshake,
  Wallet,
  User,
  Clock3,
  BadgeCheck,
  XCircle,
  Shield,
} from "lucide-react";

type DealMember = {
  id: string;
  name: string;
  image: string;
};

type DealCard = {
  id: string;
  status: "pending" | "accepted";
  offeredPrice: number;
  isSeller: boolean;
  buyer: DealMember;
  seller: DealMember;
  cardName: string;
  cardNo: string;
  cardImage: string;
  serialNo: string;
  listingStatus: string;
};

function getStatusUI(status: string) {
  switch (status) {
    case "accepted":
      return {
        label: "READY TO CLOSE",
        className:
          "border-cyan-300/20 bg-cyan-400/10 text-cyan-300",
        icon: BadgeCheck,
      };
    case "rejected":
      return {
        label: "REJECTED",
        className: "border-red-300/20 bg-red-400/10 text-red-300",
        icon: XCircle,
      };
    default:
      return {
        label: "PENDING",
        className:
          "border-amber-300/20 bg-amber-300/10 text-amber-300",
        icon: Clock3,
      };
  }
}

export default function DealsPage() {
  const [deals, setDeals] = useState<DealCard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeals = async (firstLoad = false) => {
    try {
      const res = await fetch("/api/market/deals", {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();

      if (Array.isArray(data)) {
        setDeals(data);
      } else {
        setDeals([]);
      }
    } catch (error) {
      console.error("FETCH DEALS ERROR:", error);
      if (firstLoad) setDeals([]);
    } finally {
      if (firstLoad) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals(true);

    const interval = setInterval(() => {
      fetchDeals(false);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const pendingDeals = useMemo(
    () => deals.filter((d) => d.status === "pending"),
    [deals]
  );

  const acceptedDeals = useMemo(
    () => deals.filter((d) => d.status === "accepted"),
    [deals]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#22114a_0%,#090b12_40%,#05070d_100%)] text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 text-zinc-300 shadow-[0_25px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            กำลังโหลดคำขอดีล...
          </div>
        </div>
      </div>
    );
  }

  const renderDealCard = (deal: DealCard, index: number) => {
    const statusUI = getStatusUI(deal.status);
    const StatusIcon = statusUI.icon;
    const member = deal.isSeller ? deal.buyer : deal.seller;

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
                    ? "WAITING BUYER VERIFY"
                    : "VERIFY TO CLOSE"
                  : deal.isSeller
                    ? "OWNER ACTION"
                    : "YOUR REQUEST"}
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
            Offer Price
          </div>
          <div className="mt-2 text-2xl font-black text-amber-300 sm:text-3xl">
            ฿{Number(deal.offeredPrice).toLocaleString()}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-white/[0.03] p-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              Card
            </div>

            <div className="mt-3 flex items-center gap-4">
              <img
                src={deal.cardImage}
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

                {deal.status === "accepted" && (
                  <div className="mt-2 text-[11px] text-cyan-300">
                    Reference Serial: {deal.serialNo || "-"}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <User className="h-3.5 w-3.5" />
              {deal.isSeller ? "Buyer" : "Seller"}
            </div>

            <Link
              href={`/profile/${member.id}`}
              className="mt-3 flex items-center gap-3 rounded-2xl p-2 transition hover:bg-white/[0.04]"
            >
              <img
                src={member.image || "/avatar.png"}
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
                OWNER ACTION REQUIRED
              </div>
              <DealActionButtons dealId={deal.id} />
            </>
          )}

          {deal.status === "pending" && !deal.isSeller && (
            <>
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-red-300">
                YOUR ACTIVE REQUEST
              </div>
              <CancelDealButton dealId={deal.id} />
            </>
          )}

          {deal.status === "accepted" && deal.isSeller && (
            <>
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
                DEAL ACCEPTED — WAITING BUYER VERIFY
              </div>
              <div className="rounded-xl border border-cyan-300/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                นัดเจอ ตรวจสภาพการ์ด แล้วให้ฝั่งผู้ซื้อกด Verify Serial เพื่อปิดการขายจริง
              </div>
            </>
          )}

          {deal.status === "accepted" && !deal.isSeller && (
            <>
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
                READY TO CLOSE SALE
              </div>
              <VerifySaleButton dealId={deal.id} />
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
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-violet-300 sm:text-xs">
                NEXORA DEAL CENTER
              </div>
              <h1 className="mt-2 text-2xl font-black sm:text-5xl">
                🤝 คำขอดีล
              </h1>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-amber-300/15 bg-amber-300/10 p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                  Pending
                </div>
                <div className="mt-2 text-2xl font-black text-amber-300 sm:text-3xl">
                  {pendingDeals.length}
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/10 p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                  Ready
                </div>
                <div className="mt-2 text-2xl font-black text-cyan-300 sm:text-3xl">
                  {acceptedDeals.length}
                </div>
              </div>
            </div>
          </div>
        </section>

        {acceptedDeals.length > 0 && (
          <section>
            <div className="mb-4 text-2xl font-black text-cyan-300">
              🔐 Ready to Close
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {acceptedDeals.map((deal, index) => renderDealCard(deal, index))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-4 text-2xl font-black text-amber-300">
            ⏳ Pending Requests
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pendingDeals.length > 0 ? (
              pendingDeals.map((deal, index) => renderDealCard(deal, index))
            ) : (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-10 text-center text-zinc-400 lg:col-span-2">
                ยังไม่มีคำขอดีลตอนนี้
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}