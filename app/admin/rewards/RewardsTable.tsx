"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type RewardRow = {
  id: string;
  name: string;
  imageUrl?: string | null;
  nexCost?: number | null;
  coinCost?: number | null;
  stock: number;
  createdAt: string;
};

type Props = {
  rewards: RewardRow[];
};

export default function RewardsTable({ rewards }: Props) {
  const router = useRouter();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [nexCost, setNexCost] = useState("");
  const [coinCost, setCoinCost] = useState("");
  const [stock, setStock] = useState("");

  const startEdit = (reward: RewardRow) => {
    setEditingId(reward.id);
    setNexCost(reward.nexCost?.toString() || "");
    setCoinCost(reward.coinCost?.toString() || "");
    setStock(reward.stock.toString());
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const res = await fetch("/api/admin/reward/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: editingId,
        nexCost: nexCost ? Number(nexCost) : null,
        coinCost: coinCost ? Number(coinCost) : null,
        stock: Number(stock),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "อัปเดตไม่สำเร็จ");
      return;
    }

    setEditingId(null);
    router.refresh();
  };

  const deleteReward = async (reward: RewardRow) => {
    const ok = confirm(`ยืนยันลบรางวัล "${reward.name}" ?`);
    if (!ok) return;

    const res = await fetch("/api/admin/reward/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: reward.id,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "ลบไม่สำเร็จ");
      return;
    }

    router.refresh();
  };

  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #222",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid #222" }}>
            <th style={thLeft}>รางวัล</th>
            <th style={thCenter}>NEX</th>
            <th style={thCenter}>COIN</th>
            <th style={thCenter}>Stock</th>
            <th style={thCenter}>สร้างเมื่อ</th>
            <th style={thCenter}>จัดการ</th>
          </tr>
        </thead>

        <tbody>
          {rewards.map((reward) => (
            <tr
              key={reward.id}
              style={{ borderBottom: "1px solid #1c1c1c" }}
            >
              <td style={tdLeft}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <img
                    src={
                      reward.imageUrl ||
                      "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200"
                    }
                    alt={reward.name}
                    style={{
                      width: 64,
                      height: 64,
                      objectFit: "contain",
                      borderRadius: 12,
                      background: "#0f0f0f",
                      padding: 4,
                    }}
                  />
                  <div style={{ fontWeight: "bold" }}>
                    {reward.name}
                  </div>
                </div>
              </td>

              <td style={tdCenter}>
                {reward.nexCost?.toLocaleString() || "-"}
              </td>

              <td style={tdCenter}>
                {reward.coinCost?.toLocaleString() || "-"}
              </td>

              <td style={tdCenter}>{reward.stock}</td>

              <td style={tdCenter}>
                {new Date(reward.createdAt).toLocaleString()}
              </td>

              <td style={tdCenter}>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                  }}
                >
                  <button
                    onClick={() => startEdit(reward)}
                    style={goldBtnStyle}
                  >
                    แก้ไข
                  </button>

                  <button
                    onClick={() => deleteReward(reward)}
                    style={deleteBtnStyle}
                  >
                    ลบ
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingId && (
        <div style={modalWrap}>
          <div style={modalBox}>
            <h2 style={{ marginBottom: 16 }}>
              แก้ไขราคา + สต๊อก
            </h2>

            <input
              value={nexCost}
              onChange={(e) => setNexCost(e.target.value)}
              placeholder="ราคา NEX"
              type="number"
              style={inputStyle}
            />

            <input
              value={coinCost}
              onChange={(e) => setCoinCost(e.target.value)}
              placeholder="ราคา COIN"
              type="number"
              style={inputStyle}
            />

            <input
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="Stock"
              type="number"
              style={inputStyle}
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={saveEdit}
                style={goldBtnStyle}
              >
                บันทึก
              </button>

              <button
                onClick={() => setEditingId(null)}
                style={cancelBtnStyle}
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thLeft: CSSProperties = {
  padding: 16,
  textAlign: "left",
};

const thCenter: CSSProperties = {
  padding: 16,
  textAlign: "center",
};

const tdLeft: CSSProperties = {
  padding: 16,
  textAlign: "left",
};

const tdCenter: CSSProperties = {
  padding: 16,
  textAlign: "center",
};

const goldBtnStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#d4af37",
  color: "#000",
  fontWeight: "bold",
  cursor: "pointer",
};

const deleteBtnStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,99,99,0.25)",
  background: "rgba(255,99,99,0.12)",
  color: "#ff7b7b",
  fontWeight: "bold",
  cursor: "pointer",
};

const cancelBtnStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "#1a1a1a",
  color: "#fff",
  cursor: "pointer",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  marginBottom: 12,
  borderRadius: 10,
  border: "1px solid #333",
  background: "#151515",
  color: "#fff",
};

const modalWrap: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.65)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9999,
};

const modalBox: CSSProperties = {
  width: 420,
  background: "#111",
  border: "1px solid #222",
  borderRadius: 16,
  padding: 24,
};