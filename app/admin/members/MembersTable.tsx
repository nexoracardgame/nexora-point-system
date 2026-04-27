"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatThaiDateTime } from "@/lib/thai-time";

type UserRow = {
  id: string;
  name: string | null;
  lineId: string;
  nexPoint: number;
  coin: number;
  createdAt: string;
};

export default function MembersTable({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [nexInputs, setNexInputs] = useState<Record<string, string>>({});
  const [coinInputs, setCoinInputs] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const updateMember = async (lineId: string) => {
    const nexValue = nexInputs[lineId];
    const coinValue = coinInputs[lineId];
    if (!nexValue && !coinValue) return alert("กรอก NEX หรือ COIN");

    try {
      setLoadingId(lineId);
      if (nexValue && Number(nexValue) !== 0) {
        const nexRes = await fetch("/api/point/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineId, type: "silver", amount: Number(nexValue) }),
        });
        const nexData = await nexRes.json();
        if (!nexRes.ok) return alert(nexData.error || "เพิ่ม NEX ไม่สำเร็จ");
      }
      if (coinValue && Number(coinValue) !== 0) {
        const coinRes = await fetch("/api/coin/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineId,
            amount: Math.abs(Number(coinValue)),
            action: Number(coinValue) >= 0 ? "add" : "subtract",
          }),
        });
        const coinData = await coinRes.json();
        if (!coinRes.ok) return alert(coinData.error || "เพิ่ม COIN ไม่สำเร็จ");
      }
      setNexInputs((prev) => ({ ...prev, [lineId]: "" }));
      setCoinInputs((prev) => ({ ...prev, [lineId]: "" }));
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="grid gap-3">
      {users.map((user) => (
        <div key={user.id} className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/admin/members/${user.id}`} className="text-lg font-black text-white hover:text-amber-300">
                {user.name || "-"}
              </Link>
              <div className="mt-1 break-all text-sm text-white/48">{user.lineId}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right">
              <div className="rounded-2xl border border-amber-300/15 bg-amber-300/10 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-amber-200/65">NEX</div>
                <div className="mt-1 font-black text-amber-300">{user.nexPoint}</div>
              </div>
              <div className="rounded-2xl border border-sky-300/15 bg-sky-300/10 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-sky-200/65">COIN</div>
                <div className="mt-1 font-black text-sky-300">{user.coin}</div>
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-white/42">{formatThaiDateTime(user.createdAt)}</div>

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={nexInputs[user.lineId] || ""}
              onChange={(e) => setNexInputs((prev) => ({ ...prev, [user.lineId]: e.target.value }))}
              placeholder="เพิ่ม / ลด NEX"
              type="number"
              className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none"
            />
            <input
              value={coinInputs[user.lineId] || ""}
              onChange={(e) => setCoinInputs((prev) => ({ ...prev, [user.lineId]: e.target.value }))}
              placeholder="เพิ่ม / ลด COIN"
              type="number"
              className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none"
            />
            <button
              type="button"
              onClick={() => updateMember(user.lineId)}
              disabled={loadingId === user.lineId}
              className="rounded-2xl bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-4 py-3 text-sm font-black text-black disabled:opacity-70"
            >
              {loadingId === user.lineId ? "..." : "ยืนยัน"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
