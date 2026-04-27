"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MemberActions({ lineId }: { lineId: string }) {
  const router = useRouter();
  const [nexAmount, setNexAmount] = useState("");
  const [coinAmount, setCoinAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!nexAmount && !coinAmount) return alert("กรอก NEX หรือ COIN");

    try {
      setLoading(true);
      if (nexAmount) {
        await fetch("/api/admin/members/update-nex", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineId, amount: Number(nexAmount) }),
        });
      }
      if (coinAmount) {
        await fetch("/api/admin/members/update-coin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineId, amount: Number(coinAmount) }),
        });
      }
      setNexAmount("");
      setCoinAmount("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <h2 className="text-lg font-black sm:text-xl">จัดการแต้มสมาชิก</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input value={nexAmount} onChange={(e) => setNexAmount(e.target.value)} placeholder="เพิ่ม / ลด NEX" type="number" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none" />
        <input value={coinAmount} onChange={(e) => setCoinAmount(e.target.value)} placeholder="เพิ่ม / ลด COIN" type="number" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none" />
        <button type="button" onClick={handleSubmit} disabled={loading} className="rounded-2xl bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-5 py-3 text-sm font-black text-black disabled:opacity-70">
          {loading ? "กำลังบันทึก..." : "ยืนยัน"}
        </button>
      </div>
      <div className="mt-3 text-xs text-white/42">ใส่ค่าติดลบได้ เช่น -50 เพื่อลดแต้ม</div>
    </div>
  );
}
