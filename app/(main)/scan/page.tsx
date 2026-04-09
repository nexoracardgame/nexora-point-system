"use client";

import { useEffect, useRef, useState } from "react";

type CardData = {
  cardNo: string;
  cardName: string;
  rarity: string;
  imageUrl?: string;
  marketPriceTHB?: number;
  setName?: string;
};

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState("🚀 OPENING CAMERA...");
  const [isProcessing, setIsProcessing] = useState(false);

  const drawGuide = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

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
        setTimeout(() => {
          video.play().catch(() => {});
          drawGuide();
        }, 300);

        setStatus("⚡ VISION READY");
      } catch (err) {
        console.error("CAMERA ERROR:", err);
        setStatus("❌ เปิดกล้องไม่สำเร็จ");
      }
    };

    boot();

    window.addEventListener("resize", drawGuide);

    return () => {
      window.removeEventListener("resize", drawGuide);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const captureAndAnalyze = async () => {
    if (isProcessing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !video.videoWidth) {
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

      const vw = video.videoWidth;
      const vh = video.videoHeight;

      const cropW = vw * 0.82;
      const cropH = cropW * 1.42;
      const sx = (vw - cropW) / 2;
      const sy = (vh - cropH) / 2;

      ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, 720, 1024);

      const image = canvas.toDataURL("image/jpeg", 0.8);

      const res = await fetch(
        "https://script.google.com/macros/s/AKfycbydI7TpOGs5mxgbQRTkcSpOeXBZor_2gwdqC3kKfAQCa4MWmV0XEEjJsYpfoSGzCKpI/exec",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: "nexora-scan",
            message: "ระบุเลขการ์ด NEXORA 3 หลัก",
            image,
          }),
        }
      );

      const text = await res.text();

      let json: any;
      try {
        json = JSON.parse(text);
      catch {
        console.log("GAS RAW RESPONSE:", text);
        setStatus(`❌ GAS RAW: ${text.slice(0, 120)}`);
        return;
      }

      const raw =
        typeof json === "string"
          ? json.trim()
          : typeof json?.reply === "string"
          ? json.reply.trim()
          : typeof json?.text === "string"
          ? json.text.trim()
          : typeof json?.result === "string"
          ? json.result.trim()
          : JSON.stringify(json);

      const cardNo = raw.match(/\d{3}/)?.[0];

      if (!cardNo) {
        setStatus(`❌ AI อ่านเลขไม่ได้: ${raw}`);
        return;
      }

      const cardRes = await fetch(`/api/card?cardNo=${cardNo}`);
      const data = await cardRes.json();

      setCard({
        cardNo,
        cardName: data.card_name || "Unknown Card",
        rarity: data.rarity || "-",
        imageUrl: data.image_url,
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
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-4 pb-32">
        <div className="mb-3 rounded-3xl border border-yellow-500/20 bg-white/5 px-4 py-3">
          <div className="text-sm font-bold text-yellow-300">{status}</div>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-yellow-500/30 bg-black">
          <div className="relative aspect-[4/5] w-full">
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
              <div className="mb-3 text-xs font-bold text-yellow-300">
                CARD #{card.cardNo}
              </div>
              <h2 className="text-2xl font-black">{card.cardName}</h2>
              <div className="mt-2 text-sm text-zinc-400">
                Rarity: {card.rarity}
              </div>
            </>
          ) : (
            <div className="text-sm text-zinc-400">
              วางการ์ดให้อยู่ในกรอบ แล้วแตะปุ่มเหลืองเพื่อสแกน
            </div>
          )}
        </div>
      </div>

      <button
        onClick={captureAndAnalyze}
        disabled={isProcessing}
        className="fixed bottom-6 left-1/2 z-50 flex h-24 w-24 -translate-x-1/2 items-center justify-center rounded-full border-4 border-yellow-200 bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 text-4xl text-black shadow-[0_20px_80px_rgba(234,179,8,0.45)] active:scale-95 disabled:opacity-60"
      >
        {isProcessing ? "⏳" : "📸"}
      </button>
    </div>
  );
}