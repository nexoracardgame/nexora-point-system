"use client";

import { useState } from "react";

type CouponResult = {
  code: string;
  rewardName: string;
  userName: string;
  used: boolean;
  usedAt?: string | null;
};

export default function StaffScanPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CouponResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleUseCoupon = async () => {
    if (!code.trim()) {
      setError("กรุณากรอกรหัสคูปอง");
      setMessage("");
      setResult(null);
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setResult(null);

    try {
      const res = await fetch("/api/coupon/use", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: code.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "ไม่สามารถใช้คูปองได้");
        if (data.coupon) {
          setResult(data.coupon);
        }
        return;
      }

      setMessage(data.message || "ใช้คูปองสำเร็จ");
      setResult(data.coupon);
      setCode("");
    } catch (err) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
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
        padding: "24px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "#111",
          borderRadius: "20px",
          padding: "24px",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        }}
      >
        <h1 style={{ fontSize: "28px", marginBottom: "10px" }}>
          NEXORA Staff Scan
        </h1>

        <p style={{ opacity: 0.8, marginBottom: "20px" }}>
          กรอกรหัสคูปองจาก QR เพื่อยืนยันรับรางวัล
        </p>

        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="กรอกรหัสคูปอง"
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "#1a1a1a",
            color: "#fff",
            marginBottom: "14px",
            outline: "none",
          }}
        />

        <button
          onClick={handleUseCoupon}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            border: "none",
            background: "#d4af37",
            color: "#000",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {loading ? "กำลังตรวจสอบ..." : "ยืนยันใช้คูปอง"}
        </button>

        {message && (
          <div
            style={{
              marginTop: "18px",
              padding: "14px",
              borderRadius: "12px",
              background: "rgba(0,180,90,0.12)",
              border: "1px solid rgba(0,180,90,0.35)",
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: "18px",
              padding: "14px",
              borderRadius: "12px",
              background: "rgba(255,60,60,0.12)",
              border: "1px solid rgba(255,60,60,0.35)",
            }}
          >
            {error}
          </div>
        )}

        {result && (
          <div
            style={{
              marginTop: "20px",
              padding: "16px",
              borderRadius: "14px",
              background: "#181818",
            }}
          >
            <p><strong>รหัสคูปอง:</strong> {result.code}</p>
            <p><strong>ผู้ใช้:</strong> {result.userName}</p>
            <p><strong>ของรางวัล:</strong> {result.rewardName}</p>
            <p><strong>สถานะ:</strong> {result.used ? "ใช้แล้ว" : "ยังไม่ใช้"}</p>
            {result.usedAt && (
              <p><strong>เวลาใช้งาน:</strong> {new Date(result.usedAt).toLocaleString()}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}