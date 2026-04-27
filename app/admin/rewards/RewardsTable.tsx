"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatThaiDateTime } from "@/lib/thai-time";

type RewardRow = {
  id: string;
  name: string;
  imageUrl?: string | null;
  nexCost?: number | null;
  coinCost?: number | null;
  stock: number;
  createdAt: string;
};

export default function RewardsTable({ rewards }: { rewards: RewardRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [nexCost, setNexCost] = useState("");
  const [coinCost, setCoinCost] = useState("");
  const [stock, setStock] = useState("");

  const startEdit = (reward: RewardRow) => {
    setEditingId(reward.id);
    setName(reward.name || "");
    setImageUrl(reward.imageUrl || "");
    setNexCost(reward.nexCost?.toString() || "");
    setCoinCost(reward.coinCost?.toString() || "");
    setStock(reward.stock.toString());
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const res = await fetch("/api/admin/reward/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId,
        name,
        imageUrl,
        nexCost: nexCost ? Number(nexCost) : null,
        coinCost: coinCost ? Number(coinCost) : null,
        stock: Number(stock),
      }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "อัปเดตไม่สำเร็จ");
    setEditingId(null);
    setName("");
    setImageUrl("");
    router.refresh();
  };

  const deleteReward = async (reward: RewardRow) => {
    if (!confirm(`ยืนยันลบรางวัล "${reward.name}" ?`)) return;
    const res = await fetch("/api/admin/reward/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reward.id }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "ลบไม่สำเร็จ");
    router.refresh();
  };

  return (
    <div className="grid gap-3">
      {rewards.map((reward) => (
        <div key={reward.id} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <img
              src={reward.imageUrl || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200"}
              alt={reward.name}
              className="h-28 w-full rounded-[22px] border border-white/8 bg-black/20 object-contain p-2 sm:h-32 sm:w-32"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-black">{reward.name}</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-amber-300/12 bg-amber-300/10 p-3 text-amber-300">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-amber-100/70">NEX</div>
                  <div className="mt-1 font-black">{reward.nexCost?.toLocaleString() || "-"}</div>
                </div>
                <div className="rounded-2xl border border-sky-300/12 bg-sky-300/10 p-3 text-sky-300">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-sky-100/70">COIN</div>
                  <div className="mt-1 font-black">{reward.coinCost?.toLocaleString() || "-"}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-white/38">STOCK</div>
                  <div className="mt-1 font-black text-white">{reward.stock}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-white/42">{formatThaiDateTime(reward.createdAt)}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => startEdit(reward)} className="rounded-2xl bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-4 py-3 text-sm font-black text-black">
                  แก้ไข
                </button>
                <button type="button" onClick={() => deleteReward(reward)} className="rounded-2xl border border-red-400/18 bg-red-500/10 px-4 py-3 text-sm font-black text-red-300">
                  ลบ
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {editingId ? (
        <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <div className="w-full rounded-t-[28px] border border-white/10 bg-[#101118] p-4 sm:max-w-lg sm:rounded-[28px]">
            <h2 className="text-xl font-black">แก้ไขรางวัล</h2>
            <div className="mt-4 space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อรางวัล" className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none" />
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="ลิงก์รูปรางวัล" className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none" />
              <img src={imageUrl || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200"} alt={name || "preview"} className="h-44 w-full rounded-[22px] border border-white/10 bg-black/20 object-contain p-3" />
              <div className="grid gap-3 sm:grid-cols-3">
                <input value={nexCost} onChange={(e) => setNexCost(e.target.value)} placeholder="NEX" type="number" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none" />
                <input value={coinCost} onChange={(e) => setCoinCost(e.target.value)} placeholder="COIN" type="number" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none" />
                <input value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Stock" type="number" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={saveEdit} className="rounded-2xl bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-4 py-3 text-sm font-black text-black">บันทึก</button>
                <button type="button" onClick={() => setEditingId(null)} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-white">ปิด</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
