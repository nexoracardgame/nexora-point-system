"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { nexoraAlert } from "@/lib/nexora-dialog";

function parseAdminAdjustment(value: string, label: string, integerOnly = false) {
  const raw = value.trim().replace(/[−–—]/g, "-").replace(/,/g, "");

  if (!raw) {
    return null;
  }

  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount === 0 || (integerOnly && !Number.isInteger(amount))) {
    throw new Error(`${label} ต้องเป็นตัวเลข${integerOnly ? "จำนวนเต็ม" : ""} เช่น 100 หรือ -100`);
  }

  return amount;
}

function formatSignedAdjustment(asset: "NEX" | "COIN", amount: number) {
  const action = amount < 0 ? "ลด" : "เพิ่ม";
  return `${action} ${asset} ${Math.abs(amount).toLocaleString("th-TH")} สำเร็จ`;
}

function getAdjustmentDialogMeta(nexAmount: number | null, coinAmount: number | null) {
  const amounts = [nexAmount, coinAmount].filter(
    (amount): amount is number => amount !== null
  );
  const hasDecrease = amounts.some((amount) => amount < 0);
  const hasIncrease = amounts.some((amount) => amount > 0);

  return {
    title:
      hasDecrease && !hasIncrease
        ? "ลดแต้มสำเร็จ"
        : hasDecrease && hasIncrease
          ? "อัปเดตแต้มสำเร็จ"
          : "สำเร็จ",
    tone: hasDecrease ? ("warning" as const) : ("success" as const),
  };
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
      const response = await fetch("/api/admin/members/adjust-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineId,
          nexAmount: nextNexAmount,
          coinAmount: nextCoinAmount,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data.error || "อัปเดตแต้มไม่สำเร็จ");
      }

      const message = [
        nextNexAmount !== null ? formatSignedAdjustment("NEX", nextNexAmount) : "",
        nextCoinAmount !== null ? formatSignedAdjustment("COIN", nextCoinAmount) : "",
      ]
        .filter(Boolean)
        .join("\n");
      const dialogMeta = getAdjustmentDialogMeta(nextNexAmount, nextCoinAmount);

      setNexAmount("");
      setCoinAmount("");
      router.refresh();
      await nexoraAlert({
        title: dialogMeta.title,
        message,
        tone: dialogMeta.tone,
      });
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
        <input value={nexAmount} onChange={(e) => setNexAmount(e.target.value)} placeholder="เพิ่ม / ลด NEX" type="text" inputMode="decimal" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none" />
        <input value={coinAmount} onChange={(e) => setCoinAmount(e.target.value)} placeholder="เพิ่ม / ลด COIN" type="text" inputMode="decimal" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none" />
        <button type="button" onClick={handleSubmit} disabled={loading} className="rounded-2xl bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-5 py-3 text-sm font-black text-black disabled:opacity-70">
          {loading ? "กำลังบันทึก..." : "ยืนยัน"}
        </button>
      </div>
      <div className="mt-3 text-xs text-white/42">ใส่ค่าติดลบได้ เช่น -50 เพื่อลดแต้ม</div>
    </div>
  );
}
