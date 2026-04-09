"use client";

import { useEffect, useRef, useState } from "react";
import {
  warmupCardIndex,
  matchCardFromCanvas,
  shouldAcceptMatch,
  type CardDescriptor,
} from "@/lib/card-vision";

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
  const [indexReady, setIndexReady] = useState(false);
  const [indexCount, setIndexCount] = useState(0);

  const indexRef = useRef<CardDescriptor[]>([]);

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

        setStatus("🧠 กำลังโหลดฐานข้อมูลการ์ด...");
        const descriptors = await warmupCardIndex((done, total) => {
          setIndexCount(done);
          if (done < total) {
            setStatus(`🧠 กำลังโหลดฐานข้อมูลการ์ด... ${done}/${total}`);
          }
        });

        indexRef.current = descriptors;
        setIndexReady(true);
        setStatus("⚡ CARD VISION READY");
      } catch (err) {
        console.error("SCAN BOOT ERROR:", err);
        setStatus("❌ เปิดกล้องหรือโหลดฐานข้อมูลไม่สำเร็จ");
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

    if (!indexReady || !indexRef.current.length) {
      setStatus(`⏳ รอฐานข้อมูลการ์ดก่อน... ${indexCount}/293`);
      return;
    }

    setIsProcessing(true);
    setStatus("🧠 กำลังเทียบภาพการ์ด...");

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

// 🎯 ใช้เฉพาะโซน art กลาง ลดผลกระทบกรอบ/โต๊ะ/มือ
const artCanvas = document.createElement("canvas");
artCanvas.width = 520;
artCanvas.height = 520;

const artCtx = artCanvas.getContext("2d");
if (!artCtx) throw new Error("art canvas fail");

// crop เฉพาะกลางการ์ด
artCtx.drawImage(
  canvas,
  100,   // x
  180,   // y
  520,   // width
  520,   // height
  0,
  0,
  520,
  520
);

const match = matchCardFromCanvas(artCanvas, indexRef.current);

      if (!match) {
        setStatus("❌ ไม่มีผลลัพธ์จากระบบเทียบภาพ");
        return;
      }

      if (!shouldAcceptMatch(match)) {
        setStatus(
          `⚠️ เดาว่าเป็น ${match.cardNo} (${(match.confidence * 100).toFixed(0)}%)`
        );
      }

      const cardRes = await fetch(`/api/card?cardNo=${match.cardNo}`, {
        cache: "no-store",
      });

      if (!cardRes.ok) {
        setStatus(`❌ โหลดข้อมูลการ์ด ${match.cardNo} ไม่สำเร็จ`);
        return;
      }

      const data = await cardRes.json();

      setCard({
        cardNo: match.cardNo,
        cardName: data.card_name || "Unknown Card",
        rarity: data.rarity || "-",
        imageUrl: data.image_url,
        marketPriceTHB: data.market_price_thb,
        setName: data.set_name,
      });

      setStatus(
        `🃏 เจอการ์ด ${match.cardNo} | confidence ${(match.confidence * 100).toFixed(
          0
        )}%`
      );
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ ${err?.message || "scan fail"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-4 pb-32">
        <div className="mb-3 rounded-3xl border border-yellow-500/20 bg-white/5 px-4 py-3">
          <div className="text-sm font-bold text-yellow-300">{status}</div>
          <div className="mt-1 text-[11px] text-zinc-400">
            INDEX: {indexReady ? "READY" : `${indexCount}/293`}
          </div>
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
              <div className="mt-2 text-sm text-zinc-400">Rarity: {card.rarity}</div>
              {card.setName ? (
                <div className="mt-1 text-sm text-zinc-500">Set: {card.setName}</div>
              ) : null}
              {typeof card.marketPriceTHB === "number" ? (
                <div className="mt-1 text-sm text-zinc-500">
                  Price: ฿{card.marketPriceTHB}
                </div>
              ) : null}
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
        disabled={isProcessing || !indexReady}
        className="fixed bottom-6 left-1/2 z-50 flex h-24 w-24 -translate-x-1/2 items-center justify-center rounded-full border-4 border-yellow-200 bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 text-4xl text-black shadow-[0_20px_80px_rgba(234,179,8,0.45)] active:scale-95 disabled:opacity-60"
      >
        {isProcessing ? "⏳" : "📸"}
      </button>
    </div>
  );
}