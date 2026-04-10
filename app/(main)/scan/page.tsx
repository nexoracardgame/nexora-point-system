"use client";

import { useEffect, useRef, useState } from "react";

type CardData = {
  cardNo: string;
  cardName: string;
  rarity: string;
  reward?: string;
};

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState("📸 จัดการ์ดให้อยู่ในกรอบ แล้วแตะปุ่มแชะ");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    fetch("/api/scan-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image: "warmup" }),
    }).catch(() => {});

    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setCameraReady(true);
      setStatus("📸 พร้อมแล้ว แตะปุ่มครั้งเดียวให้ AI วิเคราะห์");
    } catch (error) {
      console.error(error);
      setStatus("❌ เปิดกล้องไม่ได้");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const captureAndScan = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady || isProcessing) return;

    if (!video.videoWidth || !video.videoHeight) {
      setStatus("❌ กล้องยังไม่พร้อม");
      return;
    }

    setIsProcessing(true);
    setCard(null);
    setStatus("🧠 AI กำลังวิเคราะห์...");

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("canvas error");
      }

      // ✅ mobile-first crop: การ์ดต้องใหญ่ในเฟรม
      const cropWidth = video.videoWidth * 0.56;
      const cropHeight = cropWidth * 1.25;

      const sx = Math.max(0, (video.videoWidth - cropWidth) / 2);
      const sy = Math.max(0, (video.videoHeight - cropHeight) / 2);

      // ✅ สมดุลระหว่างความคมกับความเร็ว
      canvas.width = 960;
      canvas.height = 1200;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.drawImage(
        video,
        sx,
        sy,
        cropWidth,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const image = canvas.toDataURL("image/jpeg", 0.9);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const aiRes = await fetch("/api/scan-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const raw = await aiRes.text();

      if (!aiRes.ok) {
        throw new Error(raw || "AI server failed");
      }

      const ai = JSON.parse(raw);

      if (!ai.cardNo) {
        setStatus("❌ AI อ่านไม่ออก ขยับการ์ดให้เต็มกรอบและนิ่งอีกนิด");
        return;
      }

      setCard({
        cardNo: ai.cardNo,
        cardName: ai.card_name || ai.cardName || "Unknown Card",
        rarity: ai.rarity || "-",
        reward: ai.reward,
      });

      setStatus(
        `🃏 พบการ์ด ${ai.cardNo} • ${Math.round((ai.confidence || 0) * 100)}%`
      );
    } catch (error: any) {
      console.error(error);

      if (error?.name === "AbortError") {
        setStatus("❌ AI ตอบช้าเกินไป ลองแชะใหม่อีกครั้ง");
      } else {
        setStatus("❌ AI วิเคราะห์ไม่สำเร็จ");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative h-screen overflow-hidden bg-black text-white">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/75" />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[54vh] w-[74vw] max-w-sm rounded-[2.4rem] border-4 border-yellow-300/90 shadow-[0_0_60px_rgba(234,179,8,0.35)]" />
      </div>

      <div className="absolute left-1/2 top-4 z-20 w-[92vw] max-w-md -translate-x-1/2 rounded-2xl bg-black/35 px-4 py-3 text-center text-sm backdrop-blur-md">
        {status}
      </div>

      {card && (
        <div className="absolute bottom-28 left-1/2 z-20 w-[92vw] max-w-md -translate-x-1/2 rounded-[2rem] border border-yellow-400/30 bg-black/75 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="text-xs tracking-[0.2em] text-yellow-300">
            CARD #{card.cardNo}
          </div>
          <div className="mt-1 text-2xl font-black leading-tight">
            {card.cardName}
          </div>
          <div className="mt-2 text-sm text-zinc-300">✨ {card.rarity}</div>
          {card.reward && (
            <div className="mt-4 rounded-2xl bg-yellow-500/10 p-3 text-sm text-yellow-50">
              🎁 {card.reward}
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
        <button
          onClick={captureAndScan}
          disabled={isProcessing || !cameraReady}
          className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/90 bg-white text-4xl text-black shadow-[0_20px_80px_rgba(255,255,255,0.35)] active:scale-95 disabled:opacity-60"
        >
          {isProcessing ? "⏳" : "📸"}
        </button>
      </div>
    </div>
  );
}