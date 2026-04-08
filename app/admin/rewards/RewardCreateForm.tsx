"use client";

import type { CSSProperties, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

    if (!name || !stock) {
      alert("กรอกชื่อและสต๊อก");
      return;
    }

    if (!nexCost && !coinCost) {
      alert("ต้องใส่อย่างน้อย NEX หรือ COIN");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/admin/reward/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          imageUrl,
          nexCost: nexCost ? Number(nexCost) : null,
          coinCost: coinCost ? Number(coinCost) : null,
          stock: Number(stock),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "สร้างของรางวัลไม่สำเร็จ");
        return;
      }

      setName("");
      setImageUrl("");
      setNexCost("");
      setCoinCost("");
      setStock("");
      router.refresh();
    } catch {
      alert("เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleCreate}
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr auto",
        gap: 12,
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ชื่อของรางวัล"
        style={inputStyle}
      />

      <input
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        placeholder="ลิงก์รูปของรางวัล"
        style={inputStyle}
      />

      <input
        value={nexCost}
        onChange={(e) => setNexCost(e.target.value)}
        placeholder="ราคา NEX"
        type="number"
        min="0"
        style={inputStyle}
      />

      <input
        value={coinCost}
        onChange={(e) => setCoinCost(e.target.value)}
        placeholder="ราคา COIN"
        type="number"
        min="0"
        style={inputStyle}
      />

      <input
        value={stock}
        onChange={(e) => setStock(e.target.value)}
        placeholder="สต๊อก"
        type="number"
        min="0"
        style={inputStyle}
      />

      <button type="submit" disabled={loading} style={goldBtnStyle}>
        {loading ? "กำลังเพิ่ม..." : "เพิ่ม"}
      </button>
    </form>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "#151515",
  color: "#fff",
  outline: "none",
};

const goldBtnStyle: CSSProperties = {
  padding: "12px 18px",
  borderRadius: 10,
  border: "none",
  background: "#d4af37",
  color: "#000",
  fontWeight: "bold",
  cursor: "pointer",
};