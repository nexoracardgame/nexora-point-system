"use client";

import { useState } from "react";

export default function DealActionButtons({
  dealId,
}: {
  dealId: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: "accept" | "reject") => {
    if (loading) return;

    try {
      setLoading(true);

      const res = await fetch("/api/market/deal-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dealId, action }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "อัปเดตไม่สำเร็จ");
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-3">
      <button
        onClick={() => handleAction("accept")}
        disabled={loading}
        className="rounded-xl bg-emerald-500 px-4 py-2 font-bold text-black transition hover:scale-105 disabled:opacity-60"
      >
        ✅ Accept
      </button>

      <button
        onClick={() => handleAction("reject")}
        disabled={loading}
        className="rounded-xl bg-red-500 px-4 py-2 font-bold text-white transition hover:scale-105 disabled:opacity-60"
      >
        ❌ Reject
      </button>
    </div>
  );
}