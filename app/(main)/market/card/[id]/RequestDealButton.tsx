"use client";

import { useState } from "react";

export default function RequestDealButton({
  cardId,
  sellerId,
}: {
  cardId: string;
  sellerId: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    const offeredPrice = prompt("เสนอราคาดีล ([บาท])");
    if (!offeredPrice) return;

    const price = Number(offeredPrice);

    if (isNaN(price) || price <= 0) {
      alert("กรุณาใส่ราคาให้ถูกต้อง");
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
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert("ส่งคำขอดีลสำเร็จ 🤝");
      } else {
        alert(data.error || "ส่งไม่สำเร็จ");
      }
    } catch (error) {
      console.error("REQUEST DEAL ERROR:", error);
      alert("เกิดข้อผิดพลาดในการส่งดีล");
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
      {loading ? "⏳ Sending..." : "🤝 Request Deal"}
    </button>
  );
}