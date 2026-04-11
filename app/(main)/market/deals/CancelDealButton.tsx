"use client";

import { XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CancelDealButton({
  dealId,
}: {
  dealId: string;
}) {
  const router = useRouter();

  const handleCancel = async () => {
    const ok = confirm("ยกเลิกคำขอดีลนี้?");
    if (!ok) return;

    const res = await fetch("/api/market/deal-cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dealId }),
    });

    const data = await res.json();

    if (data.success) {
      router.refresh();
    } else {
      alert(data.error || "ยกเลิกไม่สำเร็จ");
    }
  };

  return (
    <button
      onClick={handleCancel}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 px-5 py-3 font-bold text-white shadow-lg shadow-red-500/20 transition hover:scale-[1.02]"
    >
      <XCircle className="h-4 w-4" />
      Cancel My Request
    </button>
  );
}