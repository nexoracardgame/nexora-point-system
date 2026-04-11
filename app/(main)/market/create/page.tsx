"use client";

import { useState } from "react";

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
    if (!cardNo.trim()) {
      alert("กรอกเลขการ์ดก่อน");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
        `/api/card?cardNo=${encodeURIComponent(cardNo)}`
      );

      const data = await res.json();

      setCard({
        cardNo: String(cardNo).padStart(3, "0"),
        cardName: data.card_name || `CARD ${cardNo}`,
        rarity: data.rarity || "Unknown",
        imageUrl:
          data.image_url ||
          `/cards/${String(cardNo).padStart(3, "0")}.jpg`,
      });
    } catch {
      alert("ค้นหาการ์ดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const createListing = async () => {
  if (!card) {
    alert("ค้นหาการ์ดก่อน");
    return;
  }

  if (!serialNo.trim()) {
    alert("กรอกซีเรียลหลังการ์ด");
    return;
  }

  const numericPrice = Number(price);

  if (isNaN(numericPrice) || numericPrice <= 0) {
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
      alert("🚀 วางขายสำเร็จ");
      window.location.href = "/market";
    } else {
      alert(data.error || "วางขายไม่สำเร็จ");
    }
  } catch (error) {
    console.error("CREATE LISTING ERROR:", error);
    alert("เกิดข้อผิดพลาด");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a102d_0%,#090b12_45%,#05070d_100%)] text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
        <section className="rounded-[28px] border border-amber-400/10 bg-white/[0.03] p-5 shadow-[0_20px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:rounded-[36px] md:p-8">
          <p className="text-[10px] uppercase tracking-[0.35em] text-amber-300">
            NEXORA MARKET / CREATE LISTING
          </p>

          <h1 className="mt-3 text-3xl font-black md:text-5xl">
            🏪 Luxury Listing Console
          </h1>

          <p className="mt-2 text-sm text-zinc-400 md:text-base">
            ค้นหาการ์ดจากระบบหลัก → ใส่ซีเรียล → ตั้งราคา → วางขายทันที
          </p>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          {/* LEFT PREVIEW */}
          <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5 backdrop-blur-2xl">
            {card ? (
              <>
                <img
                  src={card.imageUrl}
                  alt={card.cardName}
                  className="mx-auto aspect-[3/4] w-full max-w-sm rounded-3xl object-cover shadow-[0_0_40px_rgba(251,191,36,0.18)]"
                />

                <div className="mt-5 space-y-2">
                  <div className="text-2xl font-black">
                    {card.cardName}
                  </div>
                  <div className="text-sm text-zinc-400">
                    No.{card.cardNo} • {card.rarity}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-white/10 text-zinc-500">
                ค้นหาการ์ดเพื่อแสดงตัวอย่าง
              </div>
            )}
          </div>

          {/* RIGHT FORM */}
          <div className="space-y-5 rounded-[28px] border border-white/8 bg-white/[0.03] p-5 backdrop-blur-2xl">
            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                เลขการ์ด
              </label>
              <div className="flex gap-3">
                <input
                  value={cardNo}
                  onChange={(e) => setCardNo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      fetchCard();
                    }
                  }}
                  placeholder="เช่น 6, 06, 006"
                  className="flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 outline-none"
                />
                <button
                  onClick={fetchCard}
                  disabled={loading}
                  className="rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 px-6 font-bold text-black"
                >
                  {loading ? "..." : "ค้นหาการ์ด"}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                ซีเรียลหลังการ์ด (บังคับ)
              </label>
              <input
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                placeholder="เช่น 369789"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                ราคาวางขาย (THB)
              </label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    createListing();
                  }
                 }}
                 placeholder="เช่น 1500"
                 className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 outline-none"
               />
            </div>

            <button
              onClick={createListing}
              className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-amber-400 py-4 text-lg font-black"
            >
              🚀 วางขายการ์ดใบนี้
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}