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
  zones: number[];
};

const CARD_COUNT = 293;
const RGB_W = 48;
const RGB_H = 68;
const EDGE_W = 32;
const EDGE_H = 44;
const HIST_BINS = 8;
const MATCH_THRESHOLD = 0.68;

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
    let dot = 0, magA = 0, magB = 0;
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
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
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

  const makeZoneSignature = (data: Uint8ClampedArray, w: number, h: number) => {
    const zones = new Float32Array(12);
    const zoneW = Math.floor(w / 2);
    const zoneH = Math.floor(h / 2);
    let zi = 0;
    for (let zy = 0; zy < 2; zy++) {
      for (let zx = 0; zx < 2; zx++) {
        let sr = 0, sg = 0, sb = 0, count = 0;
        for (let y = zy * zoneH; y < (zy + 1) * zoneH; y++) {
          for (let x = zx * zoneW; x < (zx + 1) * zoneW; x++) {
            const i = (y * w + x) * 4;
            sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; count++;
          }
        }
        zones[zi++] = sr / count / 255;
        zones[zi++] = sg / count / 255;
        zones[zi++] = sb / count / 255;
      }
    }
    return zones;
  };

  const extractFeatures = (source: CanvasImageSource) => {
    const rgbData = getImageData(source, RGB_W, RGB_H);
    const edgeData = getImageData(source, EDGE_W, EDGE_H);
    return {
      rgb: Array.from(makeRgbVector(rgbData, RGB_W, RGB_H)),
      edge: Array.from(makeEdgeVector(edgeData, EDGE_W, EDGE_H)),
      hist: Array.from(makeHistogram(rgbData, RGB_W, RGB_H)),
      zones: Array.from(makeZoneSignature(rgbData, RGB_W, RGB_H)),
    };
  };

  const scoreCard = (q: CardIndexItem, item: CardIndexItem) => {
    const rgb = cosineSimilarity(q.rgb, item.rgb);
    const edge = cosineSimilarity(q.edge, item.edge);
    const hist = cosineSimilarity(q.hist, item.hist);
    const zones = cosineSimilarity(q.zones, item.zones);
    return rgb * 0.35 + edge * 0.25 + hist * 0.15 + zones * 0.25;
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
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const boxW = w * 0.54;
    const boxH = boxW * 1.42;
    const x = (w - boxW) / 2;
    const y = (h - boxH) / 2;
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, 0, w, h);
    ctx.clearRect(x, y, boxW, boxH);
    ctx.strokeStyle = "rgba(250,204,21,0.98)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 18);
    ctx.stroke();
  };

  useEffect(() => {
    const loadIndex = async () => {
      try {
        const res = await fetch(`/card-index.json?v=${Date.now()}`, { cache: "no-store" });
        const json = await res.json();
        indexRef.current = json.items || [];
        setIndexReady(indexRef.current.length > 0);
        setWarmingProgress(100);
        setStatus("⚡ SNAP READY");
      } catch {
        setStatus("📷 READY TO SNAP");
      }
    };
    loadIndex();
  }, []);

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
        await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(); });
        built.push({ cardNo, ...extractFeatures(img) });
      } catch {}
      if (i % 5 === 0 || i === CARD_COUNT) {
        indexRef.current = [...built];
        setWarmingProgress(Math.round((i / CARD_COUNT) * 100));
      }
    }
    indexRef.current = built;
    setIndexReady(true);
    setStatus("⚡ SNAP READY");
  };

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const rect = videoRef.current.getBoundingClientRect();
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = rect.width;
        overlayCanvasRef.current.height = rect.height;
        drawGuide();
      }
    }
    setStreaming(true);
    setStatus(indexRef.current.length ? "⚡ SNAP READY" : "🚀 PREPARING...");
    warmIndexInBackground();
  };

  const captureAndAnalyze = async () => {
    if (isProcessing) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    if (!indexRef.current.length) {
      setStatus(`🚀 PREPARING... ${warmingProgress}%`);
      return;
    }
    setIsProcessing(true);
    setStatus("📸 ANALYZING...");
    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      canvas.width = 280;
      canvas.height = 398;
      const vw = video.videoWidth, vh = video.videoHeight;
      const cropW = vw * 0.42;
      const cropH = cropW * 1.42;
      const sx = (vw - cropW) / 2;
      const sy = (vh - cropH) / 2;
      ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);

      const query: CardIndexItem = { cardNo: "000", ...extractFeatures(canvas) };
      let bestCard = "", bestScore = -1, second = -1;
      for (const item of indexRef.current) {
        const score = scoreCard(query, item);
        if (score > bestScore) { second = bestScore; bestScore = score; bestCard = item.cardNo; }
        else if (score > second) second = score;
      }
      const margin = Math.max(0, bestScore - Math.max(0, second));
      const finalScore = Math.min(0.999, bestScore * 0.92 + margin * 2.8);
      setConfidence(finalScore);
      setDebugLabel(bestCard);
      if (!bestCard || finalScore < MATCH_THRESHOLD) {
        setStatus(`❌ ลองจัดแสงใหม่ ${(finalScore * 100).toFixed(1)}%`);
        return;
      }
      await fetchCardData(bestCard);
      setStatus(`🃏 ${bestCard} • ${(finalScore * 100).toFixed(1)}%`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,215,0,0.08),transparent_28%),linear-gradient(180deg,#050505_0%,#0a0a0a_100%)] text-white">
      <div className="mx-auto flex h-full max-w-md flex-col px-4 py-3">
        <div className="mb-2 rounded-2xl border border-yellow-500/20 bg-white/5 px-4 py-2 text-sm font-bold text-yellow-300 backdrop-blur-xl">
          <div>{status}</div>
          <div className="mt-1 text-xs text-zinc-300">{confidence !== null ? `${(confidence * 100).toFixed(1)}%` : "READY"}{debugLabel ? ` • ${debugLabel}` : ""}</div>
        </div>

        <div className="mb-2 rounded-2xl border border-yellow-500/10 bg-white/[0.03] px-4 py-2 text-[11px] leading-5 text-zinc-300">
          💡 แสงต้องพอ • วางการ์ดให้ตรงกรอบ • อย่าให้มือบัง • กดแชะครั้งเดียว
        </div>

        <div className="relative overflow-hidden rounded-[24px] border border-yellow-500/30 bg-black shadow-[0_0_60px_rgba(234,179,8,0.12)]" style={{height:'42vh'}}>
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          <canvas ref={overlayCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="mt-3 flex-1 overflow-hidden rounded-[24px] border border-yellow-500/15 bg-white/[0.03] p-4 backdrop-blur-xl">
          {card ? (
            <div>
              <div className="mb-2 inline-flex rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">CARD #{card.cardNo}</div>
              <h2 className="text-2xl font-black leading-tight">{card.cardName}</h2>
              <p className="mt-1 text-sm text-zinc-300">{card.rarity}</p>
              <div className="mt-3 text-3xl font-black text-yellow-400">฿{Number(card.marketPriceTHB).toLocaleString("th-TH")}</div>
              <p className="mt-2 text-xs text-zinc-400">{card.setName}</p>
            </div>
          ) : (
            <div className="text-sm text-zinc-400">ผลลัพธ์จะแสดงตรงนี้ทันที ไม่ต้องเลื่อนจอ ใช้งานมือเดียวได้สบาย</div>
          )}
        </div>

        <div className="pt-3">
          {!streaming ? (
            <button onClick={startCamera} className="w-full rounded-2xl bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 py-4 font-black text-black shadow-[0_15px_50px_rgba(234,179,8,0.28)]">📷 เปิดกล้อง SNAP SCAN</button>
          ) : (
            <button onClick={captureAndAnalyze} disabled={isProcessing} className="w-full rounded-2xl bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 py-4 text-lg font-black text-black shadow-[0_15px_50px_rgba(234,179,8,0.28)] disabled:opacity-60">{isProcessing ? "⏳ กำลังคิด..." : "📸 แชะเลย"}</button>
          )}
        </div>
      </div>
    </div>
  );
}
