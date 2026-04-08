"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  lineId: string;
};

export default function MemberActions({ lineId }: Props) {
  const router = useRouter();

  const [nexAmount, setNexAmount] = useState("");
  const [coinAmount, setCoinAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!nexAmount && !coinAmount) {
      alert("กรอก NEX หรือ COIN");
      return;
    }

    try {
      setLoading(true);

      // ✅ เพิ่ม NEX
      if (nexAmount) {
        await fetch("/api/admin/member/update-nex", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lineId,
            amount: Number(nexAmount),
          }),
        });
      }

      // ✅ เพิ่ม COIN
      if (coinAmount) {
        await fetch("/api/admin/member/update-coin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lineId,
            amount: Number(coinAmount),
          }),
        });
      }

      setNexAmount("");
      setCoinAmount("");
      router.refresh();
    } catch {
      alert("เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #222",
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>
        ⚙️ จัดการแต้มสมาชิก
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto",
          gap: 12,
        }}
      >
        <input
          value={nexAmount}
          onChange={(e) => setNexAmount(e.target.value)}
          placeholder="เพิ่ม / ลด NEX"
          type="number"
          style={inputStyle}
        />

        <input
          value={coinAmount}
          onChange={(e) => setCoinAmount(e.target.value)}
          placeholder="เพิ่ม / ลด COIN"
          type="number"
          style={inputStyle}
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={goldBtnStyle}
        >
          {loading ? "กำลังบันทึก..." : "ยืนยัน"}
        </button>
      </div>

      <div
        style={{
          marginTop: 12,
          color: "#888",
          fontSize: 13,
        }}
      >
        💡 ใส่ค่าติดลบได้ เช่น -50 เพื่อลดแต้ม
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "#151515",
  color: "#fff",
  outline: "none",
};

const goldBtnStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 10,
  border: "none",
  background: "#d4af37",
  color: "#000",
  fontWeight: "bold",
  cursor: "pointer",
};