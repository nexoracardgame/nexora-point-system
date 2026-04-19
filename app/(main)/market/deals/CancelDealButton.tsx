"use client";

import { XCircle } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n";

export default function CancelDealButton({
  dealId,
  label = "Cancel My Request",
}: {
  dealId: string;
  label?: string;
}) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    if (loading) return;

    const ok = confirm("ยกเลิกคำขอดีลนี้?");
    if (!ok) return;

    try {
      setLoading(true);

      const res = await fetch("/api/market/deal-cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dealId }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "ยกเลิกไม่สำเร็จ");
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 font-bold text-white shadow-lg transition ${
        loading
          ? "cursor-not-allowed bg-zinc-600"
          : "bg-gradient-to-r from-red-500 to-rose-600 hover:scale-[1.02] shadow-red-500/20"
      }`}
    >
      <XCircle className="h-4 w-4" />
      {loading ? t("deals.cancelLoading") : label}
    </button>
  );
}
