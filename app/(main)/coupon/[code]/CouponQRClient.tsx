"use client";

import { QRCodeCanvas } from "qrcode.react";

type Props = {
  coupon: {
    code: string;
    used: boolean;
    createdAt: string;
    rewardName: string;
    rewardType: string;
    userName: string;
  };
};

export default function CouponQRClient({ coupon }: Props) {
  const qrValue = coupon.code;

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
          maxWidth: "420px",
          background: "#111",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "20px",
          padding: "24px",
          textAlign: "center",
          boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
        }}
      >
        <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>
          คูปองรับรางวัล
        </h1>

        <p style={{ opacity: 0.8, marginBottom: "20px" }}>
          แสดง QR นี้ให้พนักงานสแกนที่หน้าร้าน
        </p>

        <div
          style={{
            background: "#fff",
            padding: "16px",
            borderRadius: "16px",
            display: "inline-block",
            marginBottom: "20px",
          }}
        >
          <QRCodeCanvas value={qrValue} size={220} />
        </div>

        <div
          style={{
            textAlign: "left",
            background: "#181818",
            borderRadius: "16px",
            padding: "16px",
            marginTop: "12px",
          }}
        >
          <p><strong>ชื่อผู้ใช้:</strong> {coupon.userName}</p>
          <p><strong>ของรางวัล:</strong> {coupon.rewardName}</p>
          <p><strong>ประเภท:</strong> {coupon.rewardType}</p>
          <p><strong>รหัสคูปอง:</strong> {coupon.code}</p>
          <p>
            <strong>สถานะ:</strong>{" "}
            {coupon.used ? "ใช้แล้ว" : "ยังไม่ถูกใช้"}
          </p>
        </div>
      </div>
    </div>
  );
}