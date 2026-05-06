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
      alert("กรอกเลขการ์ดก่อน");
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
      alert("ค้นหาการ์ดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const createListing = async () => {
    if (loading) return;

    if (!card) {
      alert("ค้นหาการ์ดก่อน");
      return;
    }

    if (!serialNo.trim()) {
      alert("กรอกซีเรียลหลังการ์ด");
      return;
    }

    const numericPrice = Number(price);

    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      alert("กรอกราคาขายให้ถูกต้อง");
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

      alert(data.error || "ลงขายไม่สำเร็จ");
    } catch (error) {
      console.error("CREATE LISTING ERROR:", error);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full w-full max-w-full overflow-x-hidden rounded-[22px] bg-[radial-gradient(circle_at_top,#161018_0%,#090a0f_48%,#030406_100%)] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-0 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:gap-5 md:pb-2">
        <section className="min-w-0 overflow-hidden rounded-[24px] border border-amber-300/10 bg-white/[0.035] p-4 shadow-[0_20px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-5 md:rounded-[30px] md:p-7">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300/80 sm:tracking-[0.34em]">
            NEXORA MARKET / SELL
          </p>

          <div className="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="break-words text-[26px] font-black leading-tight sm:text-4xl md:text-5xl">
                สร้างโพสต์ขายการ์ด
              </h1>

              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-zinc-400 md:text-base">
                ค้นหาการ์ด ใส่ซีเรียล ตั้งราคา แล้วลงขายได้ทันที
              </p>
            </div>

            <div className="w-fit rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">
              Sell Mode
            </div>
          </div>
        </section>

        <MarketFeatureNav />

        <div className="grid w-full min-w-0 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="min-w-0 overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.035] p-3 text-center shadow-[0_18px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-5 md:rounded-[28px]">
            {card ? (
              <>
                <SafeCardImage
                  cardNo={card.cardNo}
                  imageUrl={card.imageUrl}
                  alt={card.cardName}
                  loading="eager"
                  fetchPriority="high"
                  className="mx-auto aspect-[3/4] w-full max-w-[230px] rounded-[22px] object-contain shadow-[0_0_40px_rgba(251,191,36,0.18)] sm:max-w-[300px] md:max-w-sm"
                />

                <div className="mt-4 min-w-0 space-y-1 text-center">
                  <div className="break-words text-xl font-black leading-tight sm:text-2xl">
                    {card.cardName}
                  </div>
                  <div className="text-sm text-zinc-400">
                    No.{card.cardNo} • {card.rarity}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[220px] items-center justify-center rounded-[22px] border border-dashed border-white/10 px-4 text-center text-sm font-bold leading-6 text-zinc-500 sm:min-h-[320px] md:min-h-[380px]">
                ค้นหาการ์ดเพื่อแสดงตัวอย่าง
              </div>
            )}
          </section>

          <section className="min-w-0 overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.035] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-5 md:rounded-[28px] md:p-6">
            <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/38">
                  Listing Details
                </div>
                <div className="mt-1 text-lg font-black">ข้อมูลลงขาย</div>
              </div>
              <div className="shrink-0 rounded-full bg-white/[0.07] px-3 py-1 text-[11px] font-black text-white/58">
                3 ขั้นตอน
              </div>
            </div>

            <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                เลขการ์ด
              </label>
              <div className="grid min-w-0 grid-cols-1 gap-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  value={cardNo}
                  onChange={(e) => setCardNo(e.target.value)}
                  inputMode="numeric"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void fetchCard();
                    }
                  }}
                  placeholder="เช่น 6, 06, 006"
                  className="min-h-[52px] min-w-0 rounded-[18px] border border-white/10 bg-black/24 px-4 py-3 text-center text-base font-bold outline-none transition placeholder:text-white/28 focus:border-amber-300/35 focus:ring-2 focus:ring-amber-300/10 min-[420px]:text-left"
                />
                <button
                  type="button"
                  onClick={fetchCard}
                  disabled={loading}
                  className="min-h-[52px] rounded-[18px] bg-gradient-to-r from-amber-300 to-yellow-500 px-5 text-sm font-black text-black shadow-[0_12px_32px_rgba(251,191,36,0.20)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "..." : "ค้นหาการ์ด"}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                ซีเรียลหลังการ์ด
              </label>
              <input
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                placeholder="เช่น 369789"
                className="min-h-[52px] w-full min-w-0 rounded-[18px] border border-white/10 bg-black/24 px-4 py-3 text-center text-base font-bold outline-none transition placeholder:text-white/28 focus:border-amber-300/35 focus:ring-2 focus:ring-amber-300/10 min-[420px]:text-left"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                ราคาวางขาย (THB)
              </label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void createListing();
                  }
                }}
                placeholder="เช่น 1500"
                className="min-h-[52px] w-full min-w-0 rounded-[18px] border border-white/10 bg-black/24 px-4 py-3 text-center text-base font-bold outline-none transition placeholder:text-white/28 focus:border-amber-300/35 focus:ring-2 focus:ring-amber-300/10 min-[420px]:text-left"
              />
            </div>

            <button
              type="button"
              onClick={createListing}
              disabled={loading}
              className="min-h-[54px] w-full rounded-[20px] bg-gradient-to-r from-violet-400 via-fuchsia-300 to-amber-300 px-4 text-center text-sm font-black text-black shadow-[0_18px_45px_rgba(168,85,247,0.24)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 sm:text-base"
            >
              {loading ? "กำลังลงขาย..." : "ลงขายการ์ดใบนี้"}
            </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
