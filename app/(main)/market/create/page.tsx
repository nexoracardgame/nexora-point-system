"use client";

import { useState } from "react";
import SafeCardImage from "@/components/SafeCardImage";
import MarketFeatureNav from "@/components/MarketFeatureNav";
import { emitMarketSync } from "@/lib/market-sync";
import { nexoraAlert } from "@/lib/nexora-dialog";

type CardData = {
  cardNo: string;
  cardName: string;
  rarity: string;
  imageUrl?: string;
};

export default function CreateListingConsole() {
  const [cardNo, setCardNo] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState<CardData | null>(null);

  const fetchCard = async () => {
    if (loading) return;

    if (!cardNo.trim()) {
      alert("เธเธฃเธญเธเน€เธฅเธเธเธฒเธฃเนเธ”เธเนเธญเธ");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`/api/card?cardNo=${encodeURIComponent(cardNo)}`);
      const data = await res.json();

      setCard({
        cardNo: String(cardNo).padStart(3, "0"),
        cardName: data.card_name || `CARD ${cardNo}`,
        rarity: data.rarity || "Unknown",
        imageUrl: data.image_url || `/cards/${String(cardNo).padStart(3, "0")}.jpg`,
      });
    } catch {
      alert("เธเนเธเธซเธฒเธเธฒเธฃเนเธ”เนเธกเนเธชเธณเน€เธฃเนเธ");
    } finally {
      setLoading(false);
    }
  };

  const createListing = async () => {
    if (loading) return;

    if (!card) {
      alert("เธเนเธเธซเธฒเธเธฒเธฃเนเธ”เธเนเธญเธ");
      return;
    }

    if (!serialNo.trim()) {
      alert("เธเธฃเธญเธเธเธตเน€เธฃเธตเธขเธฅเธซเธฅเธฑเธเธเธฒเธฃเนเธ”");
      return;
    }

    const numericPrice = Number(price);

    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      alert("เธเธฃเธญเธเธฃเธฒเธเธฒเธเธฒเธขเนเธซเนเธ–เธนเธเธ•เนเธญเธ");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/market/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardNo: card.cardNo,
          serialNo,
          price: numericPrice,
          cardName: card.cardName,
          imageUrl: card.imageUrl,
          rarity: card.rarity,
        }),
      });

      const data = await res.json();

      if (data.success) {
        emitMarketSync({
          action: data.deduped ? "updated" : "created",
          listingId: data.listing?.id,
        });
        await nexoraAlert({
          title: data.deduped ? "อัปเดตรายการแล้ว" : "ลงขายสำเร็จ",
          message: data.deduped
            ? "มีโพสต์ใบนี้อยู่แล้ว ระบบอัปเดตรายการให้เรียบร้อย"
            : "ระบบลงขายการ์ดใบนี้เรียบร้อยแล้ว",
          tone: "success",
        });
        window.location.href = "/market";
        return;
      }

      alert(data.error || "เธฅเธเธเธฒเธขเนเธกเนเธชเธณเน€เธฃเนเธ");
    } catch (error) {
      console.error("CREATE LISTING ERROR:", error);
      alert("เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a102d_0%,#090b12_45%,#05070d_100%)] text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
        <section className="rounded-[28px] border border-amber-400/10 bg-white/[0.03] p-5 text-center shadow-[0_20px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:rounded-[36px] md:p-8 md:text-left">
          <p className="text-[10px] uppercase tracking-[0.35em] text-amber-300">
            NEXORA MARKET / CREATE LISTING
          </p>

          <h1 className="mt-3 text-3xl font-black md:text-5xl">
            Luxury Listing Console
          </h1>

          <p className="mt-2 text-sm text-zinc-400 md:text-base">
            เธเนเธเธซเธฒเธเธฒเธฃเนเธ”เธเธฒเธเธฃเธฐเธเธเธซเธฅเธฑเธ เนเธชเนเธเธตเน€เธฃเธตเธขเธฅ เธ•เธฑเนเธเธฃเธฒเธเธฒ เนเธฅเนเธงเธฅเธเธเธฒเธขเนเธ”เนเธ—เธฑเธเธ—เธต
          </p>
        </section>

        <MarketFeatureNav className="mt-6" />

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5 text-center backdrop-blur-2xl">
            {card ? (
              <>
                <SafeCardImage
                  cardNo={card.cardNo}
                  imageUrl={card.imageUrl}
                  alt={card.cardName}
                  loading="eager"
                  fetchPriority="high"
                  className="mx-auto aspect-[3/4] w-full max-w-[280px] rounded-3xl object-cover shadow-[0_0_40px_rgba(251,191,36,0.18)] sm:max-w-sm"
                />

                <div className="mt-5 space-y-2 text-center">
                  <div className="text-2xl font-black">{card.cardName}</div>
                  <div className="text-sm text-zinc-400">
                    No.{card.cardNo} โ€ข {card.rarity}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-white/10 px-4 text-center text-zinc-500 sm:min-h-[420px]">
                เธเนเธเธซเธฒเธเธฒเธฃเนเธ”เน€เธเธทเนเธญเนเธชเธ”เธเธ•เธฑเธงเธญเธขเนเธฒเธ
              </div>
            )}
          </div>

          <div className="space-y-5 rounded-[28px] border border-white/8 bg-white/[0.03] p-5 backdrop-blur-2xl">
            <div>
              <label className="mb-2 block text-center text-sm font-bold text-white/80 md:text-left">
                เน€เธฅเธเธเธฒเธฃเนเธ”
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={cardNo}
                  onChange={(e) => setCardNo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void fetchCard();
                    }
                  }}
                  placeholder="เน€เธเนเธ 6, 06, 006"
                  className="flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-center outline-none sm:text-left"
                />
                <button
                  onClick={fetchCard}
                  disabled={loading}
                  className="rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 px-6 py-4 font-bold text-black disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "..." : "เธเนเธเธซเธฒเธเธฒเธฃเนเธ”"}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-center text-sm font-bold text-white/80 md:text-left">
                เธเธตเน€เธฃเธตเธขเธฅเธซเธฅเธฑเธเธเธฒเธฃเนเธ”
              </label>
              <input
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                placeholder="เน€เธเนเธ 369789"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-center outline-none sm:text-left"
              />
            </div>

            <div>
              <label className="mb-2 block text-center text-sm font-bold text-white/80 md:text-left">
                เธฃเธฒเธเธฒเธงเธฒเธเธเธฒเธข (THB)
              </label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void createListing();
                  }
                }}
                placeholder="เน€เธเนเธ 1500"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-center outline-none sm:text-left"
              />
            </div>

            <button
              onClick={createListing}
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-amber-400 py-4 text-lg font-black disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "เธเธณเธฅเธฑเธเธฅเธเธเธฒเธข..." : "เธฅเธเธเธฒเธขเธเธฒเธฃเนเธ”เนเธเธเธตเน"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
