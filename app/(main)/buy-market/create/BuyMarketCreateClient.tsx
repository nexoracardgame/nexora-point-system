"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeDollarSign, Check, Loader2 } from "lucide-react";
import BuyMarketFeatureNav from "@/components/BuyMarketFeatureNav";
import SafeCardImage from "@/components/SafeCardImage";
import {
  canChooseCardFinish,
  isForcedFoilCard,
  type MarketCardFinish,
} from "@/lib/card-finish";

function normalizeCardNo(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? String(Number(digits)).padStart(3, "0") : "";
}

export default function BuyMarketCreateClient() {
  const router = useRouter();
  const [cardNo, setCardNo] = useState("");
  const [cardName, setCardName] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [cardFinish, setCardFinish] = useState<MarketCardFinish>("normal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizedCardNo = useMemo(() => normalizeCardNo(cardNo), [cardNo]);
  const canChooseFinish = canChooseCardFinish(normalizedCardNo);
  const forcedFoil = isForcedFoilCard(normalizedCardNo);
  const selectedFinish: MarketCardFinish = forcedFoil
    ? "foil"
    : canChooseFinish
    ? cardFinish
    : "normal";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const price = Number(offerPrice);
    setError("");

    if (!normalizedCardNo) {
      setError("กรอกเลขการ์ดที่ต้องการรับซื้อก่อน");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      setError("กรอกราคารับซื้อให้ถูกต้อง");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/buy-market/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardNo: normalizedCardNo,
          cardName,
          rarity: null,
          cardFinish: selectedFinish,
          offerPrice: price,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        setError(data?.error || "สร้างโพสต์รับซื้อไม่สำเร็จ");
        return;
      }

      router.push("/buy-market#latest-buy-posts");
      router.refresh();
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างสร้างโพสต์รับซื้อ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 text-black">
      <section className="rounded-[28px] bg-white p-4 shadow-[0_24px_80px_rgba(0,0,0,0.20)] ring-1 ring-black/5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white">
              <BadgeDollarSign className="h-3.5 w-3.5" />
              Create Buy Post
            </div>
            <h1 className="mt-4 text-3xl font-black sm:text-5xl">
              สร้างการ์ดรับซื้อ
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-black/52">
              ประกาศว่าต้องการรับซื้อการ์ดใบเดียว ใส่ราคาที่พร้อมรับซื้อ แล้วรอผู้ขายส่งข้อเสนอเข้าดีล
            </p>
          </div>
        </div>
      </section>

      <BuyMarketFeatureNav />

      <form
        onSubmit={submit}
        className="grid gap-5 rounded-[28px] bg-white p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)] ring-1 ring-black/5 lg:grid-cols-[360px_minmax(0,1fr)] sm:p-5"
      >
        <div className="overflow-hidden rounded-[24px] border border-black/8 bg-[#f4f4f5]">
          <div className="relative aspect-[2.5/3.45]">
            <SafeCardImage
              cardNo={normalizedCardNo || "001"}
              imageUrl={normalizedCardNo ? `/cards/${normalizedCardNo}.jpg` : undefined}
              alt={cardName || `Card #${normalizedCardNo || "001"}`}
              className="h-full w-full object-cover"
            />
            {selectedFinish === "foil" ? (
              <div className="absolute right-3 top-3 rounded-full border border-amber-100/55 bg-[linear-gradient(135deg,rgba(255,246,196,0.96),rgba(251,191,36,0.82),rgba(255,255,255,0.74))] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-black shadow-[0_0_24px_rgba(251,191,36,0.32)]">
                Foil
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid content-start gap-4">
          <label className="block">
            <span className="mb-2 block text-xs font-black text-black/62">
              เลขการ์ด
            </span>
            <input
              value={cardNo}
              onChange={(event) => setCardNo(event.target.value)}
              inputMode="numeric"
              placeholder="เช่น 001"
              className="w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-black/35"
            />
          </label>

          {canChooseFinish ? (
            <div>
              <div className="mb-2 block text-xs font-black text-black/62">
                ประเภทการ์ดใบนี้
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["normal", "foil"] as MarketCardFinish[]).map((finish) => (
                  <button
                    key={finish}
                    type="button"
                    onClick={() => setCardFinish(finish)}
                    className={`min-h-[46px] rounded-[16px] border px-3 text-sm font-black transition ${
                      selectedFinish === finish
                        ? finish === "foil"
                          ? "border-amber-300 bg-amber-300 text-black shadow-[0_0_24px_rgba(251,191,36,0.24)]"
                          : "border-black bg-black text-white"
                        : "border-black/10 bg-white text-black/50 hover:border-black/25"
                    }`}
                  >
                    {finish === "foil" ? "ฟอยล์" : "ธรรมดา"}
                  </button>
                ))}
              </div>
            </div>
          ) : forcedFoil ? (
            <div className="rounded-[18px] border border-amber-300/35 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
              ใบนี้เป็นฟอยล์บังคับจาก Master ระบบจะติดป้าย Foil ให้เอง
            </div>
          ) : null}

          <label className="block">
            <span className="mb-2 block text-xs font-black text-black/62">
              คำประกาศซื้อ
            </span>
            <input
              value={cardName}
              onChange={(event) => setCardName(event.target.value)}
              placeholder="บอกอะไรบางอย่างกับคนที่ต้องการขายการ์ดให้กับคุณ"
              className="w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-black/35"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black text-black/62">
              ราคารับซื้อ
            </span>
            <input
              value={offerPrice}
              onChange={(event) => setOfferPrice(event.target.value)}
              inputMode="decimal"
              placeholder="0"
              className="w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-black/35"
            />
          </label>

          {error ? (
            <div className="rounded-[18px] border border-red-500/20 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[20px] bg-black px-5 py-4 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            สร้างโพสต์รับซื้อ
          </button>
        </div>
      </form>
    </div>
  );
}
