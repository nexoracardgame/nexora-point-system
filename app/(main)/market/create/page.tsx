"use client";

import { useRef, useState } from "react";

type CardData = {
  cardNo: string;
  cardName: string;
  rarity: string;
  marketPriceTHB: number;
  setName: string;
};

async function getImageHash(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      canvas.width = 8;
      canvas.height = 8;
      ctx.drawImage(img, 0, 0, 8, 8);

      const { data } = ctx.getImageData(0, 0, 8, 8);

      const gray: number[] = [];
      for (let i = 0; i < data.length; i += 4) {
        gray.push((data[i] + data[i + 1] + data[i + 2]) / 3);
      }

      const avg = gray.reduce((a, b) => a + b, 0) / gray.length;
      const hash = gray.map((v) => (v > avg ? "1" : "0")).join("");

      resolve(hash);
    };
  });
}

function hammingDistance(a: string, b: string) {
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [streaming, setStreaming] = useState(false);
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
      }
    } catch (err: any) {
      alert("เปิดกล้องไม่ได้: " + err.message);
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setLoading(true);

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.drawImage(video, 0, 0);
      const image = canvas.toDataURL("image/jpeg");

      // 🔥 สร้าง hash จากภาพที่ถ่าย
      const capturedHash = await getImageHash(image);

      let bestCardNo = "001";
      let bestDistance = Infinity;

      // 🔥 เริ่ม 50 ใบก่อน (เร็ว)
      for (let i = 1; i <= 50; i++) {
        const cardNo = String(i).padStart(3, "0");

        const templateHash = await getImageHash(`/cards/${cardNo}.jpg`);
        const distance = hammingDistance(capturedHash, templateHash);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestCardNo = cardNo;
        }
      }

      const detectedCardNo = bestCardNo;

      // 🔥 ดึงข้อมูลจาก Google Sheet API ของคุณ
      const res = await fetch(`/api/card?cardNo=${detectedCardNo}`);
      const data = await res.json();

      setCard({
        cardNo: detectedCardNo,
        cardName: data.card_name || `CARD ${detectedCardNo}`,
        rarity: data.rarity || "Unknown",
        marketPriceTHB: data.marketPriceTHB || 1500,
        setName: data.setName || "NEXORA Core Set",
      });
    } catch (error) {
      console.error(error);
      alert("สแกนไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-md px-4 py-6">
        <h1 className="mb-4 text-3xl font-black">
          📷 NEXORA LIVE SCAN
        </h1>

        {!streaming && (
          <button
            onClick={startCamera}
            className="w-full rounded-xl bg-yellow-500 py-4 font-bold text-black"
          >
            เปิดกล้อง
          </button>
        )}

        <div className="relative mt-4 overflow-hidden rounded-3xl border border-yellow-500/20">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full"
          />
        </div>

        {streaming && (
          <button
            onClick={capturePhoto}
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-green-500 py-4 font-bold"
          >
            {loading ? "กำลังสแกน..." : "📸 ถ่ายและสแกน"}
          </button>
        )}

        <canvas ref={canvasRef} className="hidden" />

        {card && (
          <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-white/5 p-4">
            <h2 className="text-2xl font-bold">{card.cardName}</h2>
            <p>Card No: {card.cardNo}</p>
            <p>Rarity: {card.rarity}</p>
            <p>Set: {card.setName}</p>

            <div className="mt-3 text-3xl font-black text-yellow-400">
              ฿{Number(card.marketPriceTHB).toLocaleString("th-TH")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}