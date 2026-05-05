"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Clock3, Loader2, MessageCircle, XCircle } from "lucide-react";
import BuyMarketFeatureNav from "@/components/BuyMarketFeatureNav";
import SafeCardImage from "@/components/SafeCardImage";
import type { BuyDealCard } from "@/lib/buy-market-types";

function formatPrice(value?: number | null) {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

function statusLabel(status: string) {
  return status === "accepted" ? "เปิดห้องแชทแล้ว" : "รอตอบรับ";
}

export default function BuyDealsClient({
  initialDeals,
}: {
  initialDeals: BuyDealCard[];
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [bootstrapped, setBootstrapped] = useState(initialDeals.length > 0);
  const [loadingId, setLoadingId] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const sortedDeals = useMemo(
    () =>
      [...deals].sort((a, b) => {
        const rank = (status: string) => (status === "accepted" ? 0 : 1);
        const rankDiff = rank(a.status) - rank(b.status);
        if (rankDiff !== 0) return rankDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [deals]
  );

  const refreshDeals = useCallback(async (silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      const res = await fetch(`/api/buy-market/deals?ts=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => []);
      if (Array.isArray(data)) {
        setDeals(data);
      }
    } catch {
      return;
    } finally {
      setBootstrapped(true);
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshDeals(true);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshDeals(true);
    }, 3500);
    const onFocus = () => void refreshDeals(true);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshDeals]);

  async function act(dealId: string, action: "accept" | "reject" | "cancel") {
    if (loadingId) return;

    try {
      setLoadingId(`${dealId}:${action}`);
      const res = await fetch("/api/buy-market/deal-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dealId, action }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        alert(data?.error || "จัดการดีลรับซื้อไม่สำเร็จ");
        return;
      }

      if (data.removedDealId) {
        setDeals((current) => current.filter((item) => item.id !== data.removedDealId));
      } else {
        await refreshDeals(true);
      }
    } catch {
      alert("จัดการดีลรับซื้อไม่สำเร็จ");
    } finally {
      setLoadingId("");
    }
  }

  function openDealChat(deal: BuyDealCard) {
    const other = deal.isBuyer ? deal.seller : deal.buyer;

    window.dispatchEvent(
      new CustomEvent("nexora:open-floating-chat", {
        detail: {
          kind: "deal",
          roomId: `deal:${deal.id}`,
          dealId: deal.id,
          userId: other.id,
          userName: other.name,
          userImage: other.image || "/avatar.png",
          dealCardName: deal.cardName,
          dealCardImage: deal.cardImage,
          dealCardNo: deal.cardNo,
          dealPrice: deal.offeredPrice,
          dealMode: "buy",
        },
      })
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 text-black">
      <section className="rounded-[28px] bg-white p-4 shadow-[0_24px_80px_rgba(0,0,0,0.20)] ring-1 ring-black/5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-black/42">
              Buy Deal Requests
            </div>
            <h1 className="mt-1 text-3xl font-black sm:text-5xl">
              ดีลรับซื้อการ์ด
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-black/52">
              หน้านี้แยกดีลรับซื้อออกจากดีลขายการ์ดใบเดียว เปิดไวและอัปเดตถี่ขึ้นเพื่อให้ตอบรับข้อเสนอขายได้ทันที
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshDeals(false)}
            className="w-fit rounded-full bg-black px-4 py-2 text-xs font-black text-white"
          >
            {refreshing ? "กำลังอัปเดต..." : "อัปเดตดีล"}
          </button>
        </div>
      </section>

      <BuyMarketFeatureNav />

      {!bootstrapped ? (
        <div className="flex items-center justify-center rounded-[28px] bg-white p-8 text-sm font-black text-black/45 shadow-[0_20px_60px_rgba(0,0,0,0.14)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          กำลังโหลดดีลรับซื้อ...
        </div>
      ) : sortedDeals.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-white/10 bg-white p-8 text-center text-sm font-bold text-black/45 shadow-[0_20px_60px_rgba(0,0,0,0.14)]">
          ยังไม่มีดีลรับซื้อ
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sortedDeals.map((deal) => {
            const accepted = deal.status === "accepted";
            const other = deal.isBuyer ? deal.seller : deal.buyer;

            return (
              <article
                key={deal.id}
                className="overflow-hidden rounded-[28px] bg-white shadow-[0_22px_70px_rgba(0,0,0,0.16)] ring-1 ring-black/5"
              >
                <div className="grid gap-0 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <div className="relative bg-[#f4f4f5] p-3">
                    <SafeCardImage
                      cardNo={deal.cardNo}
                      imageUrl={deal.cardImage}
                      alt={deal.cardName}
                      className="aspect-[2.5/3.45] w-full rounded-[22px] object-cover"
                    />
                    <div className="absolute left-5 top-5 rounded-full bg-black px-3 py-1 text-[10px] font-black text-white">
                      BUY DEAL
                    </div>
                  </div>
                  <div className="flex flex-col justify-between gap-4 p-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ${
                            accepted
                              ? "bg-black text-white"
                              : "bg-amber-100 text-amber-950"
                          }`}
                        >
                          {accepted ? (
                            <BadgeCheck className="h-3.5 w-3.5" />
                          ) : (
                            <Clock3 className="h-3.5 w-3.5" />
                          )}
                          {statusLabel(deal.status)}
                        </span>
                        <span className="rounded-full bg-[#f4f4f5] px-3 py-1 text-[11px] font-black text-black/50">
                          {deal.isBuyer ? "คุณเป็นผู้รับซื้อ" : "คุณเป็นผู้เสนอขาย"}
                        </span>
                      </div>

                      <h2 className="mt-3 line-clamp-2 text-2xl font-black leading-tight">
                        {deal.cardName}
                      </h2>
                      <div className="mt-2 text-sm font-bold text-black/48">
                        Card #{deal.cardNo} · ราคาเสนอ {formatPrice(deal.offeredPrice)}
                      </div>
                      <div className="mt-3 flex items-center gap-2 rounded-[18px] bg-[#f4f4f5] p-2">
                        <img
                          src={other.image || "/avatar.png"}
                          alt={other.name}
                          className="h-10 w-10 rounded-2xl object-cover"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-black text-black/40">
                            คู่ดีล
                          </div>
                          <div className="truncate text-sm font-black">{other.name}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {accepted ? (
                        <button
                          type="button"
                          onClick={() => openDealChat(deal)}
                          className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-black text-white"
                        >
                          <MessageCircle className="h-4 w-4" />
                          เปิดแชทดีลรับซื้อ
                        </button>
                      ) : deal.isBuyer ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void act(deal.id, "accept")}
                            className="rounded-full bg-black px-4 py-2 text-xs font-black text-white"
                          >
                            ตอบรับข้อเสนอ
                          </button>
                          <button
                            type="button"
                            onClick={() => void act(deal.id, "reject")}
                            className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-xs font-black text-red-700"
                          >
                            <XCircle className="h-4 w-4" />
                            ปฏิเสธ
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void act(deal.id, "cancel")}
                          className="rounded-full bg-black px-4 py-2 text-xs font-black text-white"
                        >
                          ยกเลิกข้อเสนอขาย
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
