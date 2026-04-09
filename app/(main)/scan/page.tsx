"use client";

import { useEffect, useRef, useState } from "react";

type CardData = {
  cardNo: string;
  cardName: string;
  rarity: string;
  marketPriceTHB: number;
  setName: string;
};

type CardIndexItem = {
  cardNo: string;
  rgb: number[];
  edge: number[];
  hist: number[];
};

const RGB_W = 56;
const RGB_H = 80;
const EDGE_W = 40;
const EDGE_H = 56;
const HIST_BINS = 8;
const MATCH_THRESHOLD = 0.62;

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const indexRef = useRef<CardIndexItem[]>([]);

  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState("🚀 OPENING CAMERA...");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const cosineSimilarity = (a: ArrayLike<number>, b: ArrayLike<number>) => {
    let dot = 0;
    let magA = 0;
    let magB = 0;

    const len = Math.min(a.length, b.length);

    for (let i = 0; i < len; i++) {
      const av = Number(a[i]) || 0;
      const bv = Number(b[i]) || 0;
      dot += av * bv;
      magA += av * av;
      magB += bv * bv;
    }

    return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-8);
  };

  const getImageData = (source: CanvasImageSource, w: number, h: number) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;

    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return new Uint8ClampedArray(w * h * 4);

    ctx.drawImage(source, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h).data;
  };

  const makeRgbVector = (data: Uint8ClampedArray, w: number, h: number) => {
    const out = new Float32Array(w * h * 3);

    for (let i = 0; i < w * h; i++) {
      out[i * 3] = data[i * 4] / 255;
      out[i * 3 + 1] = data[i * 4 + 1] / 255;
      out[i * 3 + 2] = data[i * 4 + 2] / 255;
    }

    return out;
  };

  const makeGray = (data: Uint8ClampedArray, w: number, h: number) => {
    const out = new Float32Array(w * h);

    for (let i = 0; i < w * h; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      out[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    }

    return out;
  };

  const makeEdgeVector = (data: Uint8ClampedArray, w: number, h: number) => {
    const gray = makeGray(data, w, h);
    const edge = new Float32Array(w * h);

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = gray[i + 1] - gray[i - 1];
        const gy = gray[i + w] - gray[i - w];
        edge[i] = Math.min(1, Math.sqrt(gx * gx + gy * gy));
      }
    }

    return edge;
  };

  const makeHistogram = (data: Uint8ClampedArray, w: number, h: number) => {
    const bins = new Float32Array(HIST_BINS * HIST_BINS * HIST_BINS);

    for (let i = 0; i < w * h; i++) {
      const r = Math.min(HIST_BINS - 1, Math.floor((data[i * 4] / 255) * HIST_BINS));
      const g = Math.min(HIST_BINS - 1, Math.floor((data[i * 4 + 1] / 255) * HIST_BINS));
      const b = Math.min(HIST_BINS - 1, Math.floor((data[i * 4 + 2] / 255) * HIST_BINS));

      bins[r * HIST_BINS * HIST_BINS + g * HIST_BINS + b] += 1;
    }

    return bins;
  };

  const extractFeatures = (source: CanvasImageSource) => {
    const rgbData = getImageData(source, RGB_W, RGB_H);
    const edgeData = getImageData(source, EDGE_W, EDGE_H);

    return {
      rgb: Array.from(makeRgbVector(rgbData, RGB_W, RGB_H)),
      edge: Array.from(makeEdgeVector(edgeData, EDGE_W, EDGE_H)),
      hist: Array.from(makeHistogram(rgbData, RGB_W, RGB_H)),
    };
  };

  const scoreCard = (q: CardIndexItem, item: CardIndexItem) => {
    const rgb = cosineSimilarity(q.rgb, item.rgb);
    const edge = cosineSimilarity(q.edge, item.edge);
    const hist = cosineSimilarity(q.hist, item.hist);

    return rgb * 0.5 + edge * 0.32 + hist * 0.18;
  };

  const drawGuide = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const boxW = w * 0.72;
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;

        await new Promise<void>((resolve) => {
          video.onloadedmetadata = async () => {
            await video.play();
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

        const res = await fetch("/card-index.json", {
          cache: "force-cache",
        });

        const json = await res.json();
        indexRef.current = json.items || [];

        setStatus("⚡ SNAP READY");
      } catch (err) {
        console.error(err);
        setStatus("❌ เปิดกล้องไม่สำเร็จ");
      }
    };

    boot();
  }, []);

  const analyzeOneFrame = () => {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    canvas.width = 320;
    canvas.height = 455;

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const cropW = vw * 0.62;
    const cropH = cropW * 1.42;
    const sx = (vw - cropW) / 2;
    const sy = (vh - cropH) / 2;

    ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);

    const query: CardIndexItem = {
      cardNo: "000",
      ...extractFeatures(canvas),
    };

    let bestCard = "";
    let bestScore = -1;

    for (const item of indexRef.current) {
      const score = scoreCard(query, item);
      if (score > bestScore) {
        bestScore = score;
        bestCard = item.cardNo;
      }
    }

    return { bestCard, bestScore };
  };

  const captureAndAnalyze = async () => {
    if (isProcessing) return;

    if (!indexRef.current.length) {
      setStatus("⏳ กำลังโหลดระบบ...");
      return;
    }

    setIsProcessing(true);
    setStatus("📸 ANALYZING...");

    try {
      const samples = [analyzeOneFrame(), analyzeOneFrame(), analyzeOneFrame()];
      const votes: Record<string, number> = {};

      for (const s of samples) {
        votes[s.bestCard] = (votes[s.bestCard] || 0) + s.bestScore;
      }

      const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
      const bestCard = sorted[0]?.[0];
      const score = (sorted[0]?.[1] || 0) / 3;

      setConfidence(score);

      if (!bestCard || score < MATCH_THRESHOLD) {
        setStatus("❌ ไม่มั่นใจ ลองใหม่");
        return;
      }

      setCard({
        cardNo: bestCard,
        cardName: `CARD ${bestCard}`,
        rarity: "Analyzing...",
        marketPriceTHB: 0,
        setName: "NEXORA",
      });

      setStatus(`🃏 ${bestCard} • ${(score * 100).toFixed(1)}%`);

      fetch(`/api/card?cardNo=${bestCard}`)
        .then((r) => r.json())
        .then((data) => {
          setCard({
            cardNo: bestCard,
            cardName: data.card_name || `CARD ${bestCard}`,
            rarity: data.rarity || "Unknown",
            marketPriceTHB: data.marketPriceTHB || 1500,
            setName: data.setName || "NEXORA",
          });
        });
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
            {confidence ? `${(confidence * 100).toFixed(1)}%` : "READY"}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-yellow-500/30 bg-black">
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
            </>
          ) : (
            <div className="text-sm text-zinc-400">พร้อมสแกนทันที</div>
          )}
        </div>

        <div className="sticky bottom-0 mt-auto flex justify-center pb-3 pt-3">
          <button
            type="button"
            onClick={captureAndAnalyze}
            disabled={isProcessing}
            className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-yellow-200 bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 text-4xl text-black shadow-[0_20px_80px_rgba(234,179,8,0.45)] active:scale-95"
          >
            <span className="absolute inset-2 rounded-full border-2 border-black/20" />
            <span className="relative">{isProcessing ? "⏳" : "📸"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}