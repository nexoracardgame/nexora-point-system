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
  vector: number[];
};

const CARD_COUNT = 293;
const VECTOR_SIZE = 64;
const MATCH_THRESHOLD = 0.62;
const SCAN_INTERVAL_MS = 180;

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCardRef = useRef("");
  const isPredictingRef = useRef(false);
  const indexRef = useRef<CardIndexItem[]>([]);
  const warmingRef = useRef(false);

  const [streaming, setStreaming] = useState(false);
  const [indexReady, setIndexReady] = useState(false);
  const [warmingProgress, setWarmingProgress] = useState(0);
  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState("📷 READY TO SCAN");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [debugLabel, setDebugLabel] = useState("");

  const labels = useMemo(
    () =>
      Array.from({ length: CARD_COUNT }, (_, i) =>
        String(i + 1).padStart(3, "0")
      ),
    []
  );

  const cosineSimilarity = (a: Float32Array, b: number[]) => {
    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i++) {
      const av = a[i] || 0;
      const bv = b[i] || 0;
      dot += av * bv;
      magA += av * av;
      magB += bv * bv;
    }

    return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-8);
  };

  const makeVectorFromImageData = (
    data: Uint8ClampedArray,
    size: number
  ) => {
    const vec = new Float32Array(size * size * 3);

    for (let i = 0; i < size * size; i++) {
      vec[i * 3] = data[i * 4] / 255;
      vec[i * 3 + 1] = data[i * 4 + 1] / 255;
      vec[i * 3 + 2] = data[i * 4 + 2] / 255;
    }

    return vec;
  };

  const extractVector = (source: CanvasImageSource, size = VECTOR_SIZE) => {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return new Float32Array(size * size * 3);

    ctx.drawImage(source, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    return makeVectorFromImageData(imageData.data, size);
  };

  const fetchCardData = async (cardNo: string) => {
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

    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0, 0, w, h);
    ctx.clearRect(x, y, boxW, boxH);

    ctx.strokeStyle = "rgba(250,204,21,0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 18);
    ctx.stroke();
  };

  useEffect(() => {
    const loadIndex = async () => {
      try {
        const res = await fetch(`/card-index.json?v=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("card-index not found");

        const json = await res.json();
        indexRef.current = json.items || [];
        setIndexReady(indexRef.current.length > 0);
        setWarmingProgress(100);
        setStatus("⚡ INSTANT SCAN READY");
      } catch {
        setStatus("📷 READY TO SCAN");
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

        const vector = Array.from(extractVector(img));
        built.push({ cardNo, vector });
      } catch {}

      if (i % 4 === 0 || i === CARD_COUNT) {
        indexRef.current = [...built];
        setWarmingProgress(Math.round((i / CARD_COUNT) * 100));
      }
    }

    indexRef.current = built;
    setIndexReady(built.length > 0);
    setWarmingProgress(100);
    setStatus("⚡ INSTANT SCAN READY");
  };

  const startCamera = async () => {
    try {
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
      setStatus(
        indexRef.current.length
          ? "⚡ INSTANT SCAN READY"
          : "🚀 WARMING SMART SCAN..."
      );
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
    } catch (error: any) {
      alert("เปิดกล้องไม่ได้: " + (error?.message || "unknown error"));
    }
  };

  const predict = async () => {
    if (isPredictingRef.current) return;
    isPredictingRef.current = true;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || !video.videoWidth) return;
      if (!indexRef.current.length) {
        setStatus(`🚀 WARMING SMART SCAN... ${warmingProgress}%`);
        return;
      }

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

      ctx.drawImage(
        video,
        sx,
        sy,
        cropW,
        cropH,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const query = extractVector(canvas);

      let bestCard = "";
      let bestScore = -1;
      let secondScore = -1;

      for (const item of indexRef.current) {
        const score = cosineSimilarity(query, item.vector);
        if (score > bestScore) {
          secondScore = bestScore;
          bestScore = score;
          bestCard = item.cardNo;
        } else if (score > secondScore) {
          secondScore = score;
        }
      }

      const stability = Math.max(0, bestScore - Math.max(0, secondScore));
      const displayScore = Math.min(
        0.999,
        bestScore * 0.82 + stability * 1.8
      );

      setConfidence(displayScore);
      setDebugLabel(bestCard);

      if (!bestCard) {
        setStatus(`🔍 SCANNING...`);
        return;
      }

      if (displayScore < MATCH_THRESHOLD) {
        setStatus(
          `🟡 LOCKING ${bestCard} ${(displayScore * 100).toFixed(1)}%`
        );
      }

      if (lastCardRef.current === bestCard) {
        setStatus(`🃏 ${bestCard} • ${(displayScore * 100).toFixed(1)}%`);
        return;
      }

      lastCardRef.current = bestCard;
      await fetchCardData(bestCard);
      setStatus(`🃏 ${bestCard} • ${(displayScore * 100).toFixed(1)}%`);
    } finally {
      isPredictingRef.current = false;
    }
  };

  useEffect(() => {
    if (!streaming) return;

    timerRef.current = setInterval(predict, SCAN_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [streaming, warmingProgress]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,215,0,0.08),transparent_28%),linear-gradient(180deg,#050505_0%,#0a0a0a_100%)] text-white">
      <div className="mx-auto max-w-md px-4 py-5">
        <div className="mb-3 rounded-2xl border border-yellow-500/20 bg-white/5 px-4 py-3 text-sm font-bold text-yellow-300 backdrop-blur-xl">
          <div>{status}</div>
          <div className="mt-1 text-xs text-zinc-300">
            {confidence !== null
              ? `${(confidence * 100).toFixed(1)}%`
              : "READY"}
            {debugLabel ? ` • ${debugLabel}` : ""}
            {!indexReady && warmingProgress > 0
              ? ` • INDEX ${warmingProgress}%`
              : ""}
          </div>
        </div>

        {!streaming && (
          <button
            onClick={startCamera}
            className="w-full rounded-2xl bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 py-4 font-black text-black shadow-[0_15px_50px_rgba(234,179,8,0.28)] transition-transform hover:scale-[1.01]"
          >
            📷 เปิด NEXORA INSTANT SCAN
          </button>
        )}

        <div className="relative mt-4 overflow-hidden rounded-[28px] border border-yellow-500/30 bg-black shadow-[0_0_80px_rgba(234,179,8,0.12)]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-[9/16] w-full object-cover"
          />
          <canvas
            ref={overlayCanvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="mt-5 min-h-[260px]">
          {card ? (
            <div className="rounded-[28px] border border-yellow-500/20 bg-white/5 p-5 backdrop-blur-xl shadow-[0_0_40px_rgba(250,204,21,0.08)]">
              <div className="mb-2 inline-flex rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                CARD #{card.cardNo}
              </div>
              <h2 className="text-3xl font-black leading-tight">
                {card.cardName}
              </h2>
              <p className="mt-2 text-sm text-zinc-300">{card.rarity}</p>
              <div className="mt-4 text-4xl font-black text-yellow-400">
                ฿{Number(card.marketPriceTHB).toLocaleString("th-TH")}
              </div>
              <p className="mt-2 text-xs text-zinc-400">{card.setName}</p>
            </div>
          ) : (
            <div className="rounded-[28px] border border-yellow-500/15 bg-white/[0.03] p-5 text-sm text-zinc-400 backdrop-blur-xl">
              วางการ์ดให้อยู่ในกรอบสีทอง ระบบจะจับเลขการ์ดและดึงชื่อจริงจากฐานข้อมูลให้อัตโนมัติ
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
