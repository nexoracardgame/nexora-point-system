"use client";

import * as tf from "@tensorflow/tfjs";
import { useEffect, useRef, useState } from "react";

type CardData = {
  cardNo: string;
  cardName: string;
  rarity: string;
  marketPriceTHB: number;
  setName: string;
};

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<tf.LayersModel | null>(null);

  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState("🚀 OPENING CAMERA...");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const drawGuide = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const boxW = w * 0.78;
    const boxH = boxW * 1.42;
    const x = (w - boxW) / 2;
    const y = (h - boxH) / 2;

    ctx.strokeStyle = "rgba(250,204,21,0.98)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 20);
    ctx.stroke();
  };

  useEffect(() => {
    const boot = async () => {
      try {
        setStatus("🚀 OPENING CAMERA...");

        const [stream, model] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          }),
          tf.loadLayersModel("/model/model.json"),
        ]);

        modelRef.current = model;

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;

        await new Promise<void>((resolve) => {
          video.onloadedmetadata = async () => {
            try {
              await video.play();
            } catch {}
            resolve();
          };
        });

        requestAnimationFrame(() => {
          const rect = video.getBoundingClientRect();
          const overlay = overlayCanvasRef.current;
          if (!overlay) return;

          overlay.width = rect.width;
          overlay.height = rect.height;
          drawGuide();
        });

        setStatus("⚡ AI READY");
      } catch (err) {
        console.error(err);
        setStatus("❌ เปิดกล้องหรือโมเดลไม่สำเร็จ");
      }
    };

    boot();
  }, []);

  const captureAndAnalyze = async () => {
    if (isProcessing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const model = modelRef.current;

    if (!video || !canvas || !model) {
      setStatus("⏳ AI กำลังโหลด");
      return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      setStatus("⏳ กล้องยังไม่พร้อม");
      return;
    }

    setIsProcessing(true);
    setStatus("🧠 AI กำลังคิด...");

    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        setStatus("❌ เปิด canvas ไม่สำเร็จ");
        return;
      }

      canvas.width = 224;
      canvas.height = 224;

      const vw = video.videoWidth;
      const vh = video.videoHeight;

      // crop กลางตามกรอบ
      const cropW = vw * 0.78;
      const cropH = cropW * 1.42;
      const sx = (vw - cropW) / 2;
      const sy = (vh - cropH) / 2;

      ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, 224, 224);

      const input = tf.browser
        .fromPixels(canvas)
        .toFloat()
        .div(255)
        .expandDims(0);

      const pred = model.predict(input) as tf.Tensor;
      const probs = Array.from(await pred.data());

      input.dispose();
      pred.dispose();

      if (!probs.length) {
        setStatus("❌ AI ไม่คืนผลลัพธ์");
        return;
      }

      let bestIndex = 0;
      for (let i = 1; i < probs.length; i++) {
        if (probs[i] > probs[bestIndex]) bestIndex = i;
      }

      const bestProb = probs[bestIndex];
      const cardNo = String(bestIndex + 1).padStart(3, "0");

      setConfidence(bestProb);
      setStatus(`🃏 เจอการ์ด ${cardNo} • ${(bestProb * 100).toFixed(1)}%`);

      const res = await fetch(`/api/card?cardNo=${cardNo}`, {
        cache: "no-store",
      });
      const data = await res.json();

      setCard({
        cardNo,
        cardName: data.card_name || `CARD ${cardNo}`,
        rarity: data.rarity || "Unknown",
        marketPriceTHB: data.marketPriceTHB || 1500,
        setName: data.setName || "NEXORA",
      });
    } catch (err) {
      console.error(err);
      setStatus("❌ วิเคราะห์ไม่สำเร็จ");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-4">
        <div className="mb-3 rounded-3xl border border-yellow-500/20 bg-white/5 px-4 py-3">
          <div className="text-sm font-bold text-yellow-300">{status}</div>
          <div className="mt-1 text-xs text-zinc-300">
            {confidence !== null ? `${(confidence * 100).toFixed(1)}%` : "READY"}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-yellow-500/30 bg-black shadow-[0_0_80px_rgba(234,179,8,0.15)]">
          <div className="relative aspect-[4/5] w-full bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
            />
            <canvas
              ref={overlayCanvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="mt-3 rounded-[28px] border border-yellow-500/15 bg-white/[0.04] p-5">
          {card ? (
            <>
              <div className="mb-3 inline-flex rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                CARD #{card.cardNo}
              </div>
              <h2 className="text-2xl font-black">{card.cardName}</h2>
              <p className="mt-2 text-sm text-zinc-300">{card.rarity}</p>
              <div className="mt-4 text-3xl font-black text-yellow-400">
                ฿{Number(card.marketPriceTHB).toLocaleString("th-TH")}
              </div>
              <p className="mt-2 text-xs text-zinc-400">{card.setName}</p>
            </>
          ) : (
            <div className="text-sm text-zinc-400">
              วางการ์ดให้อยู่ในกรอบ แล้วแตะปุ่มเหลืองเพื่อถ่าย
            </div>
          )}
        </div>

        <div className="sticky bottom-0 mt-auto flex justify-center pb-3 pt-3">
          <button
            type="button"
            onClick={captureAndAnalyze}
            disabled={isProcessing}
            className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-yellow-200 bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 text-4xl text-black shadow-[0_20px_80px_rgba(234,179,8,0.45)] active:scale-95 disabled:opacity-60"
          >
            <span className="absolute inset-2 rounded-full border-2 border-black/20" />
            <span className="relative">{isProcessing ? "⏳" : "📸"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}