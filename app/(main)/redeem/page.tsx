"use client";

import { useState } from "react";

export default function RedeemPage() {
  const [lineId, setLineId] = useState("");
  const [rewardId, setRewardId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRedeem = async () => {
    if (!lineId || !rewardId) {
      alert("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/reward/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lineId,
          rewardId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "แลกไม่สำเร็จ");
        return;
      }

      alert("แลกรางวัลสำเร็จ 🎉");

      // 🔥 เด้งไปหน้า QR
      window.location.href = data.couponUrl;
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fff",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#111",
          padding: "24px",
          borderRadius: "16px",
        }}
      >
        <h1 style={{ fontSize: "24px", marginBottom: "20px" }}>
          แลกรางวัล NEXORA
        </h1>

        <input
          placeholder="LINE ID"
          value={lineId}
          onChange={(e) => setLineId(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "12px",
            borderRadius: "8px",
          }}
        />

        <input
          placeholder="Reward ID"
          value={rewardId}
          onChange={(e) => setRewardId(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "20px",
            borderRadius: "8px",
          }}
        />

        <button
          onClick={handleRedeem}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            background: "#d4af37",
            color: "#000",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {loading ? "กำลังแลก..." : "แลกรางวัล"}
        </button>
      </div>
    </div>
  );
}