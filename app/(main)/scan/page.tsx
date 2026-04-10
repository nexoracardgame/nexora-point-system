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

  const [preview, setPreview] = useState("");
  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState("📸 จัดการ์ดให้อยู่ในกรอบ แล้วแตะปุ่มแชะ");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    fetch("/api/scan-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
            width: { ideal: 1280 },
            height: { ideal: 1600 },
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
      setStatus("📸 พร้อมแล้ว แตะปุ่มเพื่อแชะและส่งทันที");
    } catch (error) {
      console.error(error);
      setStatus("❌ เปิดกล้องไม่สำเร็จ กรุณาอนุญาตสิทธิ์กล้อง");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const captureAndScan = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady || isProcessing) return;

    setIsProcessing(true);
    setCard(null);
    setStatus("🧠 AI กำลังวิเคราะห์...");

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas error");

      const maxWidth = 900;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      canvas.width = Math.max(1, Math.floor(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.floor(video.videoHeight * scale));

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const image = canvas.toDataURL("image/jpeg", 0.84);
      setPreview(image);

      const aiRes = await fetch("/api/scan-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });

      const raw = await aiRes.text();
      if (!aiRes.ok) throw new Error(raw || "AI server failed");

      const ai = JSON.parse(raw);

      if (!ai.cardNo) {
        setStatus("❌ AI อ่านไม่ออก ลองขยับให้ตรงกรอบและแสงชัดขึ้น");
        return;
      }

      setCard({
        cardNo: ai.cardNo,
        cardName: ai.card_name || ai.cardName || "Unknown Card",
        rarity: ai.rarity || "-",
        reward: ai.reward,
      });

      setStatus(`🃏 ${ai.cardNo} • ${Math.round((ai.confidence || 0) * 100)}%`);
    } catch (error) {
      console.error(error);
      setStatus("❌ AI วิเคราะห์ไม่สำเร็จ");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black px-4 py-5 text-white">
      <div className="mx-auto max-w-md">
        <div className="mb-4 rounded-3xl border border-yellow-500/20 bg-white/5 p-4 text-sm backdrop-blur">
          {status}
        </div>

        <div className="relative mb-4 overflow-hidden rounded-3xl border border-yellow-500/20 bg-zinc-950">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-[4/5] w-full object-cover"
          />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[72%] w-[78%] rounded-[2rem] border-4 border-yellow-300/80 shadow-[0_0_40px_rgba(234,179,8,0.35)]" />
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={captureAndScan}
            disabled={isProcessing || !cameraReady}
            className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-yellow-200 bg-yellow-400 text-4xl text-black shadow-[0_20px_100px_rgba(234,179,8,0.55)] active:scale-95 disabled:opacity-60"
          >
            {isProcessing ? "⏳" : "📸"}
          </button>
        </div>

        {preview && (
          <div className="mt-5 overflow-hidden rounded-3xl border border-yellow-500/20">
            <img
              src={preview}
              alt="preview"
              className="aspect-[4/5] w-full object-cover"
            />
          </div>
        )}

        {card && (
          <div className="mt-6 rounded-3xl border border-yellow-500/20 bg-white/5 p-5">
            <div className="text-yellow-300">CARD #{card.cardNo}</div>
            <div className="text-2xl font-black">{card.cardName}</div>
            <div className="mt-2 text-sm text-zinc-400">✨ {card.rarity}</div>
            {card.reward && (
              <div className="mt-4 rounded-2xl bg-yellow-500/10 p-3 text-sm">
                🎁 {card.reward}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
