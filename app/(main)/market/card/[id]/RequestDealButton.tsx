"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n";

export default function RequestDealButton({
  cardId,
  sellerId,
  sellerName,
  sellerImage,
  cardName,
  cardNo,
  cardImage,
  listedPrice,
}: {
  cardId: string;
  sellerId: string;
  sellerName: string;
  sellerImage: string;
  cardName: string;
  cardNo: string;
  cardImage: string;
  listedPrice: number;
}) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    const offeredPrice = prompt(t("deals.requestPricePrompt"));
    if (!offeredPrice) return;

    const price = Number(offeredPrice);

    if (Number.isNaN(price) || price <= 0) {
      alert(t("deals.requestInvalidPrice"));
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/market/deal-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardId,
          sellerId,
          offeredPrice: price,
          sellerName,
          sellerImage,
          cardName,
          cardNo,
          cardImage,
          listedPrice,
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert(t("deals.request"));
      } else {
        alert(
          typeof data?.error === "string" && data.error.trim()
            ? data.error
            : "ระบบขอดีลชั่วคราวใช้งานไม่ได้ กรุณาลองใหม่อีกครั้งภายหลัง"
        );
      }
    } catch (error) {
      console.error("REQUEST DEAL ERROR:", error);
      alert("ระบบขอดีลชั่วคราวใช้งานไม่ได้ กรุณาลองใหม่อีกครั้งภายหลัง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleRequest}
      disabled={loading}
      className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-amber-300/20 bg-[linear-gradient(135deg,#f59e0b_0%,#fbbf24_100%)] px-6 py-3 text-sm font-black text-black shadow-[0_18px_40px_rgba(245,158,11,0.22)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(245,158,11,0.26)] disabled:cursor-not-allowed disabled:opacity-60 md:min-h-14 md:text-base"
    >
      {loading ? t("deals.requestLoading") : t("deals.request")}
    </button>
  );
}
