"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { emitMarketSync } from "@/lib/market-sync";

export default function DeleteListingButton({
  id,
  onDeleted,
}: {
  id: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      onClick={async () => {
        if (loading) return;

        const ok = confirm("ลบโพสต์ขายใบนี้ใช่ไหม?");
        if (!ok) return;

        setLoading(true);

        try {
          const res = await fetch(`/api/market/delete/${id}`, {
            method: "DELETE",
          });

          if (!res.ok) {
            const data = await res.json().catch(() => null);
            alert(data?.error || "ลบไม่สำเร็จ");
            return;
          }

          onDeleted?.();
          emitMarketSync({
            listingId: id,
            action: "deleted",
          });
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
      className="w-full rounded-2xl bg-red-500/10 px-4 py-3 text-center text-sm font-bold text-red-300 transition-all duration-300 hover:scale-[1.02] hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "กำลังลบ..." : "ลบ"}
    </button>
  );
}
