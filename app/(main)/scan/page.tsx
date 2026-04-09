"use client";

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
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState("🚀 OPENING CAMERA...");
  const [isProcessing, setIsProcessing] = useState(false);

  const drawGuide = (w: number, h: number) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);

    const boxW = w * 0.82;
    const boxH = boxW * 1.42;
    const x = (w - boxW) / 2;
    const y = (h - boxH) / 2;

    ctx.strokeStyle = "rgba(250,204,21,0.98)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 22);
    ctx.stroke();
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;

    const renderLoop = () => {
      const video = videoRef.current;
      const canvas = previewCanvasRef.current;
      if (!video || !canvas) {
        raf = requestAnimationFrame(renderLoop);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        raf = requestAnimationFrame(renderLoop);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        drawGuide(rect.width, rect.height);
      }

      if (video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      raf = requestAnimationFrame(renderLoop);
    };

    const boot = async () => {
      try {
        setStatus("🎥 กำลังเปิดกล้อง...");

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
            },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        const video = videoRef.current;
        if (!video || !stream) return;

        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;

        await video.play().catch(() => {});
        setStatus("⚡ VISION READY");

        raf = requestAnimationFrame(renderLoop);
      } catch (err) {
        console.error("CAMERA ERROR:", err);
        setStatus("❌ เปิดกล้องไม่สำเร็จ");
      }
    };

    boot();

    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const captureAndAnalyze = async () => {
    if (isProcessing) return;

    const preview = previewCanvasRef.current;
    const canvas = captureCanvasRef.current;

    if (!preview || !canvas) {
      setStatus("❌ กล้องยังไม่พร้อม");
      return;
    }

    setIsProcessing(true);
    setStatus("🧠 AI Vision กำลังดูการ์ด...");

    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas fail");

      canvas.width = 720;
      canvas.height = 1024;

      const pw = preview.width;
      const ph = preview.height;

      const cropW = pw * 0.82;
      const cropH = cropW * 1.42;
      const sx = (pw - cropW) / 2;
      const sy = (ph - cropH) / 2;

      ctx.drawImage(preview, sx, sy, cropW, cropH, 0, 0, 720, 1024);

      const image = canvas.toDataURL("image/jpeg", 0.95);

      const res = await fetch(
        "https://script.google.com/macros/s/AKfycbydI7TpOGs5mxgbQRTkcSpOeXBZor_2gwdqC3kKfAQCa4MWmV0XEEjJsYpfoSGzCKpI/exec",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: "nexora-scan",
            message:
              "ดูภาพนี้ว่าเป็นการ์ด NEXORA หมายเลขอะไร ให้ตอบเป็นเลข 3 หลักเท่านั้น เช่น 029",
            image,
          }),
        }
      );

      const json = await res.json();
      const raw = String(json.reply || "").trim();

      const match = raw.match(/\d{1,3}/);
      const cardNo = match ? match[0].padStart(3, "0") : "";

      if (!cardNo) {
        setStatus("❌ AI อ่านเลขไม่ออก");
        return;
      }

      const cardRes = await fetch(`/api/card?cardNo=${cardNo}`);
      const data = await cardRes.json();

      setCard({
        cardNo,
        cardName: data.card_name || `CARD ${cardNo}`,
        rarity: data.rarity || "Unknown",
        marketPriceTHB: data.marketPriceTHB || 1500,
        setName: data.setName || "NEXORA",
      });

      setStatus(`🃏 เจอการ์ด ${cardNo}`);
    } catch (err: any) {
      setStatus(`❌ ${err?.message || "Vision fail"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-4">
        <div className="mb-3 rounded-3xl border border-yellow-500/20 bg-white/5 px-4 py-3">
          <div className="text-sm font-bold text-yellow-300">{status}</div>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-yellow-500/30 bg-black">
          <div className="relative aspect-[4/5] w-full">
            <canvas
              ref={previewCanvasRef}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <canvas
              ref={overlayCanvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
            <video ref={videoRef} className="hidden" />
          </div>
        </div>

        <canvas ref={captureCanvasRef} className="hidden" />

        <div className="mt-3 rounded-[28px] border border-yellow-500/15 bg-white/[0.04] p-5">
          {card ? (
            <>
              <div className="mb-3 text-xs font-bold text-yellow-300">
                CARD #{card.cardNo}
              </div>
              <h2 className="text-2xl font-black">{card.cardName}</h2>
            </>
          ) : (
            <div className="text-sm text-zinc-400">
              วางการ์ดให้อยู่ในกรอบ แล้วแตะปุ่มเหลืองเพื่อสแกน
            </div>
          )}
        </div>

        <div className="sticky bottom-0 mt-auto flex justify-center pb-3 pt-3">
          <button
            onClick={captureAndAnalyze}
            disabled={isProcessing}
            className="h-24 w-24 rounded-full bg-yellow-400 text-4xl text-black"
          >
            {isProcessing ? "⏳" : "📸"}
          </button>
        </div>
      </div>
    </div>
  );
}