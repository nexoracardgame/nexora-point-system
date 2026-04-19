"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n";

export default function DealActionButtons({
  dealId,
}: {
  dealId: string;
}) {
  const { t } = useLanguage();
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
        alert(data.error || "Request failed");
      }
    } catch (error) {
      console.error(error);
      alert("Request failed");
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
        {t("deals.accept")}
      </button>

      <button
        onClick={() => handleAction("reject")}
        disabled={loading}
        className="rounded-xl bg-red-500 px-4 py-2 font-bold text-white transition hover:scale-105 disabled:opacity-60"
      >
        {t("deals.reject")}
      </button>
    </div>
  );
}
