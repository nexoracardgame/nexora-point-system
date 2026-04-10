"use client";

import { useEffect, useRef, useState } from "react";

type CardData = {
  cardNo: string;
  cardName: string;
  rarity: string;
  reward?: string;
};

const LENS_PRESETS = [
  { label: "0.5", zoom: 0.5 },
  { label: "1", zoom: 1 },
  { label: "2", zoom: 2 },
  { label: "3", zoom: 3 },
];

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState(
    "📸 จัดการ์ดให้อยู่ในกรอบ"
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    fetch("/api/scan-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image: "warmup" }),
    }).catch(() => {});

    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 3840 },
            height: { ideal: 2160 },
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
      setStatus("📸 พร้อมแล้ว ภาพคมระดับสูง");
    } catch (error) {
      console.error(error);
      setStatus("❌ เปิดกล้องไม่ได้");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) =>
      t.stop()
    );
    streamRef.current = null;
  };

  const captureAndScan = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady || isProcessing) return;

    setIsProcessing(true);
    setCard(null);
    setStatus("🧠 AI กำลังวิเคราะห์ภาพคมสูง...");

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas error");

      const baseCropWidth = video.videoWidth * 0.72;
      const cropWidth = baseCropWidth / zoomLevel;
      const cropHeight = cropWidth * 1.35;

      const sx =
        (video.videoWidth - cropWidth) / 2;
      const sy =
        (video.videoHeight - cropHeight) / 2;

      // 🚀 ส่งภาพใหญ่ขึ้นให้ AI
      canvas.width = 1280;
      canvas.height = 1730;

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

      const image = canvas.toDataURL(
        "image/jpeg",
        0.94
      );

      const aiRes = await fetch("/api/scan-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image }),
      });

      const raw = await aiRes.text();

      if (!aiRes.ok) {
        throw new Error(raw || "AI server failed");
      }

      const ai = JSON.parse(raw);

      if (!ai.cardNo) {
        setStatus(
          "❌ AI อ่านไม่ออก ลองใช้ 1x หรือขยับให้ตรงกรอบ"
        );
        return;
      }

      setCard({
        cardNo: ai.cardNo,
        cardName:
          ai.card_name ||
          ai.cardName ||
          "Unknown Card",
        rarity: ai.rarity || "-",
        reward: ai.reward,
      });

      setStatus(
        `🃏 ${ai.cardNo} • ${Math.round(
          (ai.confidence || 0) * 100
        )}%`
      );
    } catch (error) {
      console.error(error);
      setStatus("❌ AI วิเคราะห์ไม่สำเร็จ");
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

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[52vh] w-[72vw] max-w-sm rounded-[2.5rem] border-4 border-yellow-300/90 shadow-[0_0_60px_rgba(234,179,8,0.35)]" />
      </div>

      <div className="absolute top-4 left-1/2 z-20 w-[92vw] max-w-md -translate-x-1/2 rounded-2xl bg-black/35 px-4 py-3 text-center text-sm backdrop-blur-md">
        {status}
      </div>

      <div className="absolute bottom-24 right-4 z-30">
        <div className="flex gap-2 rounded-2xl bg-black/45 p-2 backdrop-blur-md">
          {LENS_PRESETS.map((lens) => {
            const active = zoomLevel === lens.zoom;

            return (
              <button
                key={lens.label}
                onClick={() => setZoomLevel(lens.zoom)}
                className={`h-10 min-w-10 rounded-full px-3 text-xs font-bold transition ${
                  active
                    ? "bg-white text-black shadow-lg"
                    : "bg-white/10 text-white"
                }`}
              >
                {lens.label}
              </button>
            );
          })}
        </div>
      </div>

      {card && (
        <div className="absolute bottom-28 left-1/2 z-20 w-[92vw] max-w-md -translate-x-1/2 rounded-[2rem] border border-yellow-400/30 bg-black/75 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="text-xs tracking-[0.2em] text-yellow-300">
            CARD #{card.cardNo}
          </div>
          <div className="mt-1 text-2xl font-black leading-tight">
            {card.cardName}
          </div>
          <div className="mt-2 text-sm text-zinc-300">
            ✨ {card.rarity}
          </div>
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