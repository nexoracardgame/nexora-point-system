"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SellToBuyerButton({
  listingId,
  defaultPrice,
}: {
  listingId: string;
  defaultPrice: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function submitOffer() {
    const raw = prompt(
      "กรอกราคาที่คุณต้องการเสนอขายให้ผู้รับซื้อ",
      String(defaultPrice || "")
    );
    if (!raw) return;

    const offeredPrice = Number(raw);
    if (!Number.isFinite(offeredPrice) || offeredPrice <= 0) {
      alert("กรอกราคาเสนอขายให้ถูกต้อง");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/buy-market/deal-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listingId,
          offeredPrice,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        alert(data?.error || "ส่งข้อเสนอขายไม่สำเร็จ");
        return;
      }

      alert("ส่งข้อเสนอขายให้ผู้รับซื้อสำเร็จ");
      router.push("/buy-market/deals");
      router.refresh();
    } catch {
      alert("ส่งข้อเสนอขายไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={submitOffer}
      disabled={loading}
      className="inline-flex min-h-14 w-full items-center justify-center rounded-[20px] bg-black px-5 py-4 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {loading ? "กำลังส่งข้อเสนอ..." : "เสนอขายการ์ดนี้"}
    </button>
  );
}
