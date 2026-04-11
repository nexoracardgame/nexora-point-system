export const revalidate = 15;

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DealActionButtons from "./DealActionButtons";
import CancelDealButton from "./CancelDealButton";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  Handshake,
  Wallet,
  User,
  Clock3,
  BadgeCheck,
  XCircle,
} from "lucide-react";

function getStatusUI(status: string) {
  switch (status) {
    case "accepted":
      return {
        label: "ACCEPTED",
        className:
          "border-emerald-300/20 bg-emerald-400/10 text-emerald-300",
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

export default async function DealsPage() {
  const session = await getServerSession(authOptions);
  const currentUserId = String((session?.user as any)?.id || "");

  const deals = await prisma.dealRequest.findMany({
  where: {
    status: "pending",
  },
  orderBy: {
    createdAt: "desc",
  },
  });

  const buyerIds = [...new Set(deals.map((deal) => deal.buyerId))];
  const cardIds = [...new Set(deals.map((deal) => deal.cardId))];

  const [buyers, listings] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: {
          in: buyerIds,
        },
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        image: true,
      },
    }),

    prisma.marketListing.findMany({
      where: {
        id: {
          in: cardIds,
        },
      },
      select: {
        id: true,
        cardNo: true,
        cardName: true,
        imageUrl: true,
      },
    }),
  ]);

  const buyerMap = new Map(
    buyers.map((buyer) => [
      buyer.id,
      {
        id: buyer.id,
        name: buyer.displayName || buyer.name || "Unknown Buyer",
        image: buyer.image || "/avatar.png",
      },
    ])
  );

  const listingMap = new Map(
    listings.map((listing) => [listing.id, listing])
  );

  const pendingCount = deals.filter((d) => d.status === "pending").length;
  const acceptedCount = deals.filter((d) => d.status === "accepted").length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#22114a_0%,#090b12_40%,#05070d_100%)] text-white">
      <div className="relative mx-auto max-w-7xl space-y-5 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6">
        {/* HERO */}
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_25px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:rounded-[40px] sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-violet-300 sm:text-xs">
                NEXORA DEAL CENTER
              </div>
              <h1 className="mt-2 text-2xl font-black sm:text-5xl">
                🤝 คำขอดีล
              </h1>
              <p className="mt-2 text-xs text-zinc-400 sm:text-base">
                จัดการคำขอซื้อขายการ์ดทั้งหมดแบบเรียลไทม์
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-amber-300/15 bg-amber-300/10 p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                  Pending
                </div>
                <div className="mt-2 text-2xl font-black text-amber-300 sm:text-3xl">
                  {pendingCount}
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-300/15 bg-emerald-300/10 p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                  Accepted
                </div>
                <div className="mt-2 text-2xl font-black text-emerald-300 sm:text-3xl">
                  {acceptedCount}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DEAL LIST */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {deals.length > 0 ? (
            deals.map((deal, index) => {
              const statusUI = getStatusUI(deal.status);
              const StatusIcon = statusUI.icon;

              const buyer = buyerMap.get(deal.buyerId);
              const listing = listingMap.get(deal.cardId);

              const isSeller = currentUserId === deal.sellerId;
              const isBuyer = currentUserId === deal.buyerId;

              const englishName =
                listing?.cardName || "Unknown Card";

              const thaiName =
                listing?.cardNameThai ||
                listing?.cardNameTH ||
                "";

              return (
                <div
                  key={deal.id}
                  className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-5"
                >
                  {/* HEADER */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300 sm:h-12 sm:w-12">
                        <Handshake className="h-5 w-5" />
                      </div>

                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                          Deal Request
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

                  <div className="mt-4 space-y-4">
                    {/* PRICE */}
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <Wallet className="h-4 w-4" />
                        Offer Price
                      </div>
                      <div className="mt-2 text-2xl font-black text-amber-300 sm:text-3xl">
                        ฿{Number(deal.offeredPrice).toLocaleString()}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {/* BIG CARD */}
                      <div className="rounded-2xl bg-white/[0.03] p-4">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                          Card
                        </div>

                        <div className="mt-3 flex items-center gap-4">
                          <img
                            src={
                              listing?.imageUrl ||
                              `/cards/${String(
                                listing?.cardNo || "001"
                              ).padStart(3, "0")}.jpg`
                            }
                            alt={englishName}
                            className="aspect-[2/3] w-20 rounded-2xl border border-white/10 object-cover shadow-xl sm:w-24"
                          />

                          <div className="min-w-0">
                            <div className="truncate text-base font-black text-white/90 sm:text-lg">
                              {englishName}
                            </div>

                            <div className="mt-1 truncate text-xs text-zinc-400 sm:text-sm">
                              {thaiName}
                            </div>

                            <div className="mt-2 text-sm text-amber-300">
                              #{String(
                                listing?.cardNo || "001"
                              ).padStart(3, "0")}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* BUYER */}
                      <div className="rounded-2xl bg-white/[0.03] p-4">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                          <User className="h-3.5 w-3.5" />
                          Deal Member
                        </div>

                        <Link
                          href={`/profile/${buyer?.id}`}
                          className="mt-3 flex items-center gap-3 rounded-2xl p-2 transition hover:bg-white/[0.04]"
                        >
                          <img
                            src={buyer?.image || "/avatar.png"}
                            alt={buyer?.name}
                            className="h-12 w-12 rounded-full border border-white/10 object-cover"
                          />

                          <div className="truncate text-sm font-bold text-white/85">
                            {buyer?.name || "Unknown Buyer"}
                          </div>
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* ACTION */}
                  {deal.status === "pending" && (
                    <div className="mt-4 rounded-2xl border border-violet-400/15 bg-violet-500/5 p-3">
                      {isSeller && <DealActionButtons dealId={deal.id} />}
                      {isBuyer && <CancelDealButton dealId={deal.id} />}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-10 text-center text-zinc-400 lg:col-span-2">
              ยังไม่มีคำขอดีลตอนนี้
            </div>
          )}
        </section>
      </div>
    </div>
  );
}