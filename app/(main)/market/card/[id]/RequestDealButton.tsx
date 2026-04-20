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
  serialNo,
}: {
  cardId: string;
  sellerId: string;
  sellerName: string;
  sellerImage: string;
  cardName: string;
  cardNo: string;
  cardImage: string;
  listedPrice: number;
  serialNo?: string | null;
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
          serialNo,
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
      className="rounded-2xl bg-gradient-to-r from-orange-400 to-amber-500 px-6 py-3 font-bold text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? t("deals.requestLoading") : t("deals.request")}
    </button>
  );
}
