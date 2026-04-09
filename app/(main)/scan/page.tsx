"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

const CARD_COUNT = 293;
const RGB_W = 36;
const RGB_H = 52;
const EDGE_W = 24;
const EDGE_H = 34;
const HIST_BINS = 8;
const MATCH_THRESHOLD = 0.72;

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const indexRef = useRef<CardIndexItem[]>([]);
  const warmingRef = useRef(false);

  const [streaming, setStreaming] = useState(false);
  const [indexReady, setIndexReady] = useState(false);
  const [warmingProgress, setWarmingProgress] = useState(0);
  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState("📷 READY TO SNAP");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [debugLabel, setDebugLabel] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const labels = useMemo(
    () => Array.from({ length: CARD_COUNT }, (_, i) => String(i + 1).padStart(3, "0")),
    []
  );

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

  const createCanvas = (w: number, h: number) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };

  const getImageDataFromSource = (source: CanvasImageSource, w: number, h: number) => {
    const c = createCanvas(w, h);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return new Uint8ClampedArray(w * h * 4);
    ctx.drawImage(source, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h).data;
  };

  const makeRgbVector = (data: Uint8ClampedArray, w: number, h: number) => {
    const vec = new Float32Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      vec[i * 3] = data[i * 4] / 255;
      vec[i * 3 + 1] = data[i * 4 + 1] / 255;
      vec[i * 3 + 2] = data[i * 4 + 2] / 255;
    }
    return vec;
  };

  const makeGray = (data: Uint8ClampedArray, w: number, h: number) => {
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      gray[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    }
    return gray;
  };

  const makeEdgeVector = (data: Uint8ClampedArray, w: number, h: number) => {
    const gray = makeGray(data, w, h);
    const edge = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = -gray[(y - 1) * w + (x - 1)] + gray[(y - 1) * w + (x + 1)] - 2 * gray[y * w + (x - 1)] + 2 * gray[y * w + (x + 1)] - gray[(y + 1) * w + (x - 1)] + gray[(y + 1) * w + (x + 1)];
        const gy = -gray[(y - 1) * w + (x - 1)] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + (x + 1)] + gray[(y + 1) * w + (x - 1)] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + (x + 1)];
        edge[i] = Math.min(1, Math.sqrt(gx * gx + gy * gy));
      }
    }
    return edge;
  };

  const makeHistogram = (data: Uint8ClampedArray, w: number, h: number) => {
    const bins = new Float32Array(HIST_BINS * HIST_BINS * HIST_BINS);
    for (let i = 0; i < w * h; i++) {
      const r = data[i * 4] / 255;
      const g = data[i * 4 + 1] / 255;
      const b = data[i * 4 + 2] / 255;
      const rb = Math.min(HIST_BINS - 1, Math.floor(r * HIST_BINS));
      const gb = Math.min(HIST_BINS - 1, Math.floor(g * HIST_BINS));
      const bb = Math.min(HIST_BINS - 1, Math.floor(b * HIST_BINS));
      bins[rb * HIST_BINS * HIST_BINS + gb * HIST_BINS + bb] += 1;
    }
    let mag = 0;
    for (let i = 0; i < bins.length; i++) mag += bins[i] * bins[i];
    mag = Math.sqrt(mag) || 1;
    for (let i = 0; i < bins.length; i++) bins[i] /= mag;
    return bins;
  };

  const extractCardFeatures = (source: CanvasImageSource) => {
    const rgbData = getImageDataFromSource(source, RGB_W, RGB_H);
    const edgeData = getImageDataFromSource(source, EDGE_W, EDGE_H);
    return {
      rgb: Array.from(makeRgbVector(rgbData, RGB_W, RGB_H)),
      edge: Array.from(makeEdgeVector(edgeData, EDGE_W, EDGE_H)),
      hist: Array.from(makeHistogram(rgbData, RGB_W, RGB_H)),
    };
  };

  const scoreCard = (query: CardIndexItem, item: CardIndexItem) => {
    const rgbScore = cosineSimilarity(query.rgb, item.rgb);
    const edgeScore = cosineSimilarity(query.edge, item.edge);
    const histScore = cosineSimilarity(query.hist, item.hist);
    return rgbScore * 0.45 + edgeScore * 0.35 + histScore * 0.2;
  };

  const fetchCardData = async (cardNo: string) => {
    const res = await fetch(`/api/card?cardNo=${cardNo}`, { cache: "no-store" });
    const data = await res.json();
    setCard({
      cardNo,
      cardName: data.card_name || `CARD ${cardNo}`,
      rarity: data.rarity || "Unknown",
      marketPriceTHB: data.marketPriceTHB || 1500,
      setName: data.setName || "NEXORA Core Set",
    });
  };

  const drawGuide = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const boxW = w * 0.58;
    const boxH = boxW * 1.42;
    const x = (w - boxW) / 2;
    const y = (h - boxH) / 2;

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, w, h);
    ctx.clearRect(x, y, boxW, boxH);

    ctx.strokeStyle = "rgba(250,204,21,0.96)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 18);
    ctx.stroke();
  };

  useEffect(() => {
    const loadIndex = async () => {
      try {
        const res = await fetch(`/card-index.json?v=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error("card-index not found");
        const json = await res.json();
        indexRef.current = json.items || [];
        setIndexReady(indexRef.current.length > 0);
        setWarmingProgress(100);
        setStatus("⚡ SNAP SCAN READY");
      } catch {
        setStatus("📷 READY TO SNAP");
      }
    };
    loadIndex();
  }, []);

  useEffect(() => {
    const onResize = () => {
      const video = videoRef.current;
      const overlay = overlayCanvasRef.current;
      if (!video || !overlay) return;
      const rect = video.getBoundingClientRect();
      overlay.width = rect.width;
      overlay.height = rect.height;
      drawGuide();
    };

    window.addEventListener("resize", onResize);
    const t = setTimeout(onResize, 300);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(t);
    };
  }, [streaming]);

  const warmIndexInBackground = async () => {
    if (warmingRef.current || indexRef.current.length) return;
    warmingRef.current = true;
    const built: CardIndexItem[] = [];

    for (let i = 1; i <= CARD_COUNT; i++) {
      const cardNo = labels[i - 1];
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = `/cards/${cardNo}.jpg?v=1`;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
        });
        built.push({ cardNo, ...extractCardFeatures(img) });
      } catch {}
      if (i % 4 === 0 || i === CARD_COUNT) {
        indexRef.current = [...built];
        setWarmingProgress(Math.round((i / CARD_COUNT) * 100));
      }
    }

    indexRef.current = built;
    setIndexReady(true);
    setWarmingProgress(100);
    setStatus("⚡ SNAP SCAN READY");
  };

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }

    setStreaming(true);
    setStatus(indexRef.current.length ? "⚡ SNAP SCAN READY" : "🚀 PREPARING SNAP ENGINE...");
    warmIndexInBackground();

    setTimeout(() => {
      const video = videoRef.current;
      const overlay = overlayCanvasRef.current;
      if (!video || !overlay) return;
      const rect = video.getBoundingClientRect();
      overlay.width = rect.width;
      overlay.height = rect.height;
      drawGuide();
    }, 200);
  };

  const captureAndAnalyze = async () => {
    if (isProcessing) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    if (!indexRef.current.length) {
      setStatus(`🚀 PREPARING SNAP ENGINE... ${warmingProgress}%`);
      return;
    }

    setIsProcessing(true);
    setStatus("📸 PROCESSING SNAP...");

    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = 320;
      canvas.height = 455;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cropW = vw * 0.46;
      const cropH = cropW * 1.42;
      const sx = (vw - cropW) / 2;
      const sy = (vh - cropH) / 2;

      ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);

      const query: CardIndexItem = {
        cardNo: "000",
        ...extractCardFeatures(canvas),
      };

      let bestCard = "";
      let bestScore = -1;
      let secondScore = -1;

      for (const item of indexRef.current) {
        const score = scoreCard(query, item);
        if (score > bestScore) {
          secondScore = bestScore;
          bestScore = score;
          bestCard = item.cardNo;
        } else if (score > secondScore) {
          secondScore = score;
        }
      }

      const margin = Math.max(0, bestScore - Math.max(0, secondScore));
      const displayScore = Math.min(0.999, bestScore * 0.9 + margin * 2.4);

      setConfidence(displayScore);
      setDebugLabel(bestCard);

      if (!bestCard || displayScore < MATCH_THRESHOLD) {
        setStatus(`❌ ไม่มั่นใจพอ ${(displayScore * 100).toFixed(1)}% • ลองจัดแสงและวางให้ตรงกรอบ`);
        return;
      }

      await fetchCardData(bestCard);
      setStatus(`🃏 ${bestCard} • ${(displayScore * 100).toFixed(1)}%`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,215,0,0.08),transparent_28%),linear-gradient(180deg,#050505_0%,#0a0a0a_100%)] text-white">
      <div className="mx-auto max-w-md px-4 py-5">
        <div className="mb-3 rounded-2xl border border-yellow-500/20 bg-white/5 px-4 py-3 text-sm font-bold text-yellow-300 backdrop-blur-xl">
          <div>{status}</div>
          <div className="mt-1 text-xs text-zinc-300">
            {confidence !== null ? `${(confidence * 100).toFixed(1)}%` : "READY"}
            {debugLabel ? ` • ${debugLabel}` : ""}
            {!indexReady && warmingProgress > 0 ? ` • ENGINE ${warmingProgress}%` : ""}
          </div>
        </div>

        <div className="mb-3 rounded-2xl border border-yellow-500/10 bg-white/[0.03] px-4 py-3 text-xs leading-6 text-zinc-300">
          💡 แนะนำ: ใช้งานในที่มีแสงสว่างเพียงพอ • วางการ์ดให้ตรงกรอบสีทอง • อย่าให้มือบังมุมการ์ด • กดแชะ 1 ครั้งต่อ 1 ใบเพื่อความแม่นยำสูงสุด
        </div>

        {!streaming ? (
          <button
            onClick={startCamera}
            className="w-full rounded-2xl bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 py-4 font-black text-black shadow-[0_15px_50px_rgba(234,179,8,0.28)]"
          >
            📷 เปิดกล้อง SNAP SCAN
          </button>
        ) : (
          <button
            onClick={captureAndAnalyze}
            disabled={isProcessing}
            className="w-full rounded-2xl bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 py-4 font-black text-black shadow-[0_15px_50px_rgba(234,179,8,0.28)] disabled:opacity-60"
          >
            {isProcessing ? "⏳ กำลังประมวลผล..." : "📸 แชะการ์ดใบนี้"}
          </button>
        )}

        <div className="relative mt-4 overflow-hidden rounded-[28px] border border-yellow-500/30 bg-black shadow-[0_0_80px_rgba(234,179,8,0.12)]">
          <video ref={videoRef} autoPlay playsInline muted className="aspect-[9/16] w-full object-cover" />
          <canvas ref={overlayCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="mt-5 min-h-[260px]">
          {card ? (
            <div className="rounded-[28px] border border-yellow-500/20 bg-white/5 p-5 backdrop-blur-xl shadow-[0_0_40px_rgba(250,204,21,0.08)]">
              <div className="mb-2 inline-flex rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                CARD #{card.cardNo}
              </div>
              <h2 className="text-3xl font-black leading-tight">{card.cardName}</h2>
              <p className="mt-2 text-sm text-zinc-300">{card.rarity}</p>
              <div className="mt-4 text-4xl font-black text-yellow-400">฿{Number(card.marketPriceTHB).toLocaleString("th-TH")}</div>
              <p className="mt-2 text-xs text-zinc-400">{card.setName}</p>
            </div>
          ) : (
            <div className="rounded-[28px] border border-yellow-500/15 bg-white/[0.03] p-5 text-sm text-zinc-400 backdrop-blur-xl">
              วางการ์ดให้อยู่ในกรอบ แล้วกดปุ่ม “แชะการ์ดใบนี้” เพื่อวิเคราะห์แบบคมที่สุด
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
