"use client";

import { useEffect, useRef, useState } from "react";

type CardData = {
  cardNo: string;
  cardName: string;
  rarity: string;
  marketPriceTHB: number;
  setName: string;
};

type CardFeature = {
  cardNo: string;
  vector: Float32Array;
};

const CARD_COUNT = 293;
const VECTOR_SIZE = 16;
const MATCH_THRESHOLD = 0.88;

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const featuresRef = useRef<CardFeature[]>([]);
  const isPredictingRef = useRef(false);
  const lastCardRef = useRef("");

  const [streaming, setStreaming] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState("🧠 PRELOADING 293 CARDS...");
  const [confidence, setConfidence] = useState<number | null>(null);

  const makeCardNo = (n: number) => String(n).padStart(3, "0");

  const extractVectorFromSource = (
    source: CanvasImageSource,
    size = VECTOR_SIZE
  ) => {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return new Float32Array(size * size);

    ctx.drawImage(source, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const vec = new Float32Array(size * size);

    for (let i = 0; i < size * size; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      vec[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    }

    return vec;
  };

  const cosineSimilarity = (a: Float32Array, b: Float32Array) => {
    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-8);
  };

  useEffect(() => {
    let mounted = true;

    const preloadAllCards = async () => {
      const loaded: CardFeature[] = [];

      for (let i = 1; i <= CARD_COUNT; i++) {
        const cardNo = makeCardNo(i);

        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = `/cards/${cardNo}.jpg?v=1`;

          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
          });

          loaded.push({
            cardNo,
            vector: extractVectorFromSource(img),
          });
        } catch {}

        if (mounted) {
          setLoadingProgress(Math.round((i / CARD_COUNT) * 100));
          setStatus(`🧠 PRELOADING ${i}/${CARD_COUNT}`);
        }
      }

      featuresRef.current = loaded;

      if (mounted) {
        setReady(true);
        setStatus(`🔥 WORLD SCAN READY ${loaded.length} CARDS`);
      }
    };

    preloadAllCards();

    return () => {
      mounted = false;
    };
  }, []);

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      setStreaming(true);
      setStatus("📷 LIVE WORLD SCAN");
    }
  };

  const predict = async () => {
    if (isPredictingRef.current) return;
    isPredictingRef.current = true;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth) return;
      if (!featuresRef.current.length) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = 320;
      canvas.height = 460;

      // crop center like card box
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cropW = vw * 0.42;
      const cropH = cropW * 1.42;
      const sx = (vw - cropW) / 2;
      const sy = (vh - cropH) / 2;

      ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, 320, 460);

      const query = extractVectorFromSource(canvas);

      let bestCard = "";
      let bestScore = -1;

      for (const item of featuresRef.current) {
        const score = cosineSimilarity(query, item.vector);
        if (score > bestScore) {
          bestScore = score;
          bestCard = item.cardNo;
        }
      }

      setConfidence(bestScore);

      if (!bestCard || bestScore < MATCH_THRESHOLD) {
        setStatus(`🔍 MATCHING... ${(bestScore * 100).toFixed(1)}%`);
        return;
      }

      if (lastCardRef.current === bestCard) return;
      lastCardRef.current = bestCard;

      const res = await fetch(`/api/card?cardNo=${bestCard}`, {
        cache: "no-store",
      });
      const data = await res.json();

      setCard({
        cardNo: bestCard,
        cardName: data.card_name || `CARD ${bestCard}`,
        rarity: data.rarity || "Unknown",
        marketPriceTHB: data.marketPriceTHB || 1500,
        setName: data.setName || "NEXORA Core Set",
      });

      setStatus(`🃏 ${bestCard} • ${(bestScore * 100).toFixed(1)}%`);
    } finally {
      isPredictingRef.current = false;
    }
  };

  useEffect(() => {
    if (!streaming || !ready) return;

    timerRef.current = setInterval(predict, 180);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [streaming, ready]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-md px-4 py-5">
        <div className="mb-3 text-sm font-bold text-yellow-300">
          {status}
          {!ready && ` • ${loadingProgress}%`}
          {confidence !== null && ready
            ? ` • ${(confidence * 100).toFixed(1)}%`
            : ""}
        </div>

        {!streaming && ready && (
          <button
            onClick={startCamera}
            className="w-full rounded-2xl bg-yellow-500 py-4 font-black text-black"
          >
            📷 เปิด WORLD CLASS 293 SCAN
          </button>
        )}

        <div className="relative mt-4 overflow-hidden rounded-3xl border border-yellow-500/30">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-3xl object-cover"
          />
          <div className="pointer-events-none absolute inset-[18%] border-2 border-yellow-400/80 rounded-2xl shadow-[0_0_40px_rgba(250,204,21,0.35)]" />
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="mt-5 min-h-[260px]">
          {card && (
            <div className="rounded-3xl border border-yellow-500/20 bg-white/5 p-5 backdrop-blur-xl">
              <h2 className="text-3xl font-black">{card.cardName}</h2>
              <p className="mt-2">Card #{card.cardNo}</p>
              <p className="mt-1 text-sm text-zinc-300">{card.rarity}</p>
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
