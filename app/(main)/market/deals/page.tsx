export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import DealActionButtons from "./DealActionButtons";
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
  const deals = await prisma.dealRequest.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  const buyerIds = [...new Set(deals.map((deal) => deal.buyerId).filter(Boolean))];

  const buyers = await prisma.user.findMany({
    where: {
      id: {
        in: buyerIds,
      },
    },
    select: {
      id: true,
      name: true,
      displayName: true,
    },
  });

  const buyerMap = new Map(
    buyers.map((buyer) => [
      buyer.id,
      buyer.displayName || buyer.name || buyer.id,
    ])
  );

  const pendingCount = deals.filter((d) => d.status === "pending").length;
  const acceptedCount = deals.filter((d) => d.status === "accepted").length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#22114a_0%,#090b12_40%,#05070d_100%)] text-white">
      {/* BG FX */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[10%] top-[10%] h-[220px] w-[220px] rounded-full bg-violet-500/10 blur-3xl sm:h-[380px] sm:w-[380px]" />
        <div className="absolute bottom-[10%] right-[8%] h-[220px] w-[220px] rounded-full bg-amber-400/10 blur-3xl sm:h-[340px] sm:w-[340px]" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-5 p-3 sm:space-y-6 sm:p-6">
        {/* HERO */}
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:rounded-[40px] sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-violet-300 sm:text-xs">
                NEXORA DEAL CENTER
              </div>
              <h1 className="mt-2 text-3xl font-black sm:text-5xl">
                🤝 Deal Requests
              </h1>
              <p className="mt-2 text-sm text-zinc-400 sm:text-base">
                จัดการข้อเสนอซื้อขายทั้งหมดในตลาดแบบเรียลไทม์
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
              <div className="rounded-3xl border border-amber-300/15 bg-amber-300/10 p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                  Pending
                </div>
                <div className="mt-2 text-3xl font-black text-amber-300">
                  {pendingCount}
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-300/15 bg-emerald-300/10 p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                  Accepted
                </div>
                <div className="mt-2 text-3xl font-black text-emerald-300">
                  {acceptedCount}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DEAL LIST */}
        <section className="grid gap-4 sm:gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {deals.length > 0 ? (
            deals.map((deal) => {
              const statusUI = getStatusUI(deal.status);
              const StatusIcon = statusUI.icon;
              const buyerName = buyerMap.get(deal.buyerId) || deal.buyerId;

              return (
                <div
                  key={deal.id}
                  className="group rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition duration-500 hover:-translate-y-1 hover:border-violet-400/30 hover:shadow-[0_0_60px_rgba(139,92,246,0.12)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
                        <Handshake className="h-5 w-5" />
                      </div>

                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                          Deal ID
                        </div>
                        <div className="font-mono text-sm font-bold text-white/80">
                          {deal.id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>

                    <div
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] ${statusUI.className}`}
                    >
                      <StatusIcon className="h-4 w-4" />
                      {statusUI.label}
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <Wallet className="h-4 w-4" />
                        Offer Price
                      </div>
                      <div className="mt-2 text-3xl font-black text-amber-300">
                        {Number(deal.offeredPrice).toLocaleString()} NEX
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white/[0.03] p-4">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                          Card
                        </div>
                        <div className="mt-2 break-all text-sm font-bold text-white/85">
                          {deal.cardId}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-white/[0.03] p-4">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                          <User className="h-3.5 w-3.5" />
                          Buyer
                        </div>
                        <div className="mt-2 truncate text-sm font-bold text-white/85">
                          {buyerName}
                        </div>
                      </div>
                    </div>
                  </div>

                  {deal.status === "pending" && (
                    <div className="mt-5 rounded-2xl border border-violet-400/15 bg-violet-500/5 p-3">
                      <DealActionButtons dealId={deal.id} />
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-10 text-center text-zinc-400 lg:col-span-2 2xl:col-span-3">
              ยังไม่มี deal requests ตอนนี้
            </div>
          )}
        </section>
      </div>
    </div>
  );
}