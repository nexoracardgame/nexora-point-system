"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function parseAdminAdjustment(value: string, label: string, integerOnly = false) {
  const raw = value.trim();

  if (!raw) {
    return null;
  }

  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount === 0 || (integerOnly && !Number.isInteger(amount))) {
    throw new Error(`${label} ต้องเป็นตัวเลข${integerOnly ? "จำนวนเต็ม" : ""} เช่น 100 หรือ -100`);
  }

  return amount;
}

export default function MemberActions({ lineId }: { lineId: string }) {
  const router = useRouter();
  const [nexAmount, setNexAmount] = useState("");
  const [coinAmount, setCoinAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    let nextNexAmount: number | null = null;
    let nextCoinAmount: number | null = null;

    try {
      nextNexAmount = parseAdminAdjustment(nexAmount, "NEX");
      nextCoinAmount = parseAdminAdjustment(coinAmount, "COIN", true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "จำนวนไม่ถูกต้อง");
      return;
    }

    if (nextNexAmount === null && nextCoinAmount === null) return alert("กรอก NEX หรือ COIN");

    try {
      setLoading(true);
      if (nextNexAmount !== null) {
        const response = await fetch("/api/admin/members/update-nex", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineId, amount: nextNexAmount }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "อัปเดต NEX ไม่สำเร็จ");
      }
      if (nextCoinAmount !== null) {
        const response = await fetch("/api/admin/members/update-coin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineId, amount: nextCoinAmount }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "อัปเดต COIN ไม่สำเร็จ");
      }
      setNexAmount("");
      setCoinAmount("");
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "อัปเดตแต้มไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <h2 className="text-lg font-black sm:text-xl">จัดการแต้มสมาชิก</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input value={nexAmount} onChange={(e) => setNexAmount(e.target.value)} placeholder="เพิ่ม / ลด NEX" type="number" step="any" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none" />
        <input value={coinAmount} onChange={(e) => setCoinAmount(e.target.value)} placeholder="เพิ่ม / ลด COIN" type="number" step="1" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none" />
        <button type="button" onClick={handleSubmit} disabled={loading} className="rounded-2xl bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-5 py-3 text-sm font-black text-black disabled:opacity-70">
          {loading ? "กำลังบันทึก..." : "ยืนยัน"}
        </button>
      </div>
      <div className="mt-3 text-xs text-white/42">ใส่ค่าติดลบได้ เช่น -50 เพื่อลดแต้ม</div>
    </div>
  );
}
