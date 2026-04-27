"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RewardCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [nexCost, setNexCost] = useState("");
  const [coinCost, setCoinCost] = useState("");
  const [stock, setStock] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !stock) return alert("กรอกชื่อและสต๊อก");
    if (!nexCost && !coinCost) return alert("ต้องใส่อย่างน้อย NEX หรือ COIN");

    try {
      setLoading(true);
      const res = await fetch("/api/admin/reward/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          imageUrl,
          nexCost: nexCost ? Number(nexCost) : null,
          coinCost: coinCost ? Number(coinCost) : null,
          stock: Number(stock),
        }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || "สร้างของรางวัลไม่สำเร็จ");
      setName("");
      setImageUrl("");
      setNexCost("");
      setCoinCost("");
      setStock("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleCreate} className="grid gap-3 lg:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_auto]">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อของรางวัล" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none" />
      <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="ลิงก์รูปรางวัล" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none" />
      <input value={nexCost} onChange={(e) => setNexCost(e.target.value)} placeholder="ราคา NEX" type="number" min="0" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none" />
      <input value={coinCost} onChange={(e) => setCoinCost(e.target.value)} placeholder="ราคา COIN" type="number" min="0" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none" />
      <input value={stock} onChange={(e) => setStock(e.target.value)} placeholder="สต๊อก" type="number" min="0" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none" />
      <button type="submit" disabled={loading} className="rounded-2xl bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-5 py-3 text-sm font-black text-black disabled:opacity-70">
        {loading ? "กำลังเพิ่ม..." : "เพิ่ม"}
      </button>
    </form>
  );
}
