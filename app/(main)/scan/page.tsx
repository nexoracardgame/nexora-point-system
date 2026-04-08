"use client";

import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";

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
  const modelRef = useRef<tf.LayersModel | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCardRef = useRef("");
  const isPredictingRef = useRef(false);

  const [streaming, setStreaming] = useState(false);
  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState("LOADING 293 AI...");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [debugLabel, setDebugLabel] = useState("");

  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        modelRef.current = await tf.loadLayersModel("/model/model.json");
        setStatus("🔥 293 AI READY");
      } catch (error) {
        console.error(error);
        setStatus("MODEL LOAD ERROR");
      }
    };

    loadModel();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
        setStatus("📷 LIVE SCAN");
      }
    } catch (error: any) {
      alert("เปิดกล้องไม่ได้: " + error.message);
    }
  };

  const predict = async () => {
    if (isPredictingRef.current) return;
    isPredictingRef.current = true;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const model = modelRef.current;

      if (!video || !canvas || !model) return;
      if (!video.videoWidth) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = 224;
      canvas.height = 224;
      ctx.drawImage(video, 0, 0, 224, 224);

      const input = tf.browser
        .fromPixels(canvas)
        .toFloat()
        .div(255)
        .expandDims(0);

      const output = model.predict(input) as tf.Tensor;
      const scores = Array.from(await output.data());

      tf.dispose([input, output]);

      let bestIndex = 0;
      let bestScore = 0;

      for (let i = 0; i < scores.length; i++) {
        if (scores[i] > bestScore) {
          bestScore = scores[i];
          bestIndex = i;
        }
      }

      // ✅ ใช้ index ตรงจาก model 293 ใบ
      const cardNo = String(bestIndex + 1).padStart(3, "0");

      setDebugLabel(cardNo);
      setConfidence(bestScore);

      // 🔥 threshold ใหม่กันมั่ว
      if (bestScore > 0.65) {
        if (lastCardRef.current === cardNo) return;
        lastCardRef.current = cardNo;

        const res = await fetch(`/api/card?cardNo=${cardNo}`, {
          cache: "no-store",
        });

        const data = await res.json();

        setCard({
          cardNo,
          cardName: data.card_name || `CARD ${cardNo}`,
          rarity: data.rarity || "Unknown",
          marketPriceTHB: data.marketPriceTHB || 1500,
          setName: data.setName || "NEXORA Core Set",
        });

        setStatus(`🃏 DETECTED ${cardNo} • ${(bestScore * 100).toFixed(1)}%`);
      } else {
        setStatus(`🔍 SCANNING ${cardNo}`);
      }
    } finally {
      isPredictingRef.current = false;
    }
  };

  useEffect(() => {
    if (!streaming) return;

    timerRef.current = setInterval(() => {
      predict();
    }, 350);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [streaming]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-md px-4 py-5">
        <div className="mb-3 text-sm font-bold text-yellow-300">
          {status}
          {confidence !== null &&
            ` • ${(confidence * 100).toFixed(1)}% • ${debugLabel}`}
        </div>

        {!streaming && (
          <button
            onClick={startCamera}
            className="w-full rounded-2xl bg-yellow-500 py-4 font-black text-black"
          >
            📷 เปิดกล้อง AI Scan 293 ใบ
          </button>
        )}

        <div className="relative mt-4 overflow-hidden rounded-3xl border border-yellow-500/20">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full object-cover"
          />
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="mt-5 min-h-[260px]">
          {card && (
            <div className="rounded-3xl border border-yellow-500/20 bg-white/5 p-5">
              <h2 className="text-3xl font-black">{card.cardName}</h2>
              <p className="mt-2">Card #{card.cardNo}</p>
              <div className="mt-4 text-4xl font-black text-yellow-400">
                ฿{Number(card.marketPriceTHB).toLocaleString("th-TH")}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}