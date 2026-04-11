"use client";

import { useEffect, useRef, useState } from "react";

type CardData = {
  cardNo: string;
  cardName: string;
  rarity?: string;
  reward?: string;
  collection?: string;
  collectionReward?: string;
};

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState("📸 จัดการ์ดให้อยู่ในกรอบ แล้วแตะปุ่มแชะ");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    const warm = setInterval(() => {
  if (isProcessing) return;

  fetch("/api/scan-ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: "warmup" }),
  }).catch(() => {});
}, 30000);

    startCamera();

    return () => {
      clearInterval(warm)
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        await new Promise<void>((resolve) => {
          const video = videoRef.current!;
          video.onloadedmetadata = async () => {
           await video.play().catch(() => {});
           resolve();
    };
  });
}

      setCameraReady(true);
      setStatus("📸 พร้อมแล้ว แตะปุ่มครั้งเดียวให้ AI วิเคราะห์");
    } catch (error) {
      console.error(error);
      setStatus("❌ เปิดกล้องไม่ได้");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const getCardFromSheet = async (cardNo: string): Promise<CardData> => {
    const res = await fetch(`/api/card?cardNo=${encodeURIComponent(cardNo)}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        cardNo,
        cardName: "Unknown Card",
        rarity: "-",
      };
    }

    const data = await res.json();

    return {
      cardNo: data.cardNo || data.card_no || cardNo,
      cardName:
        data.cardName ||
        data.card_name ||
        data.name ||
        `Card ${cardNo}`,
      rarity: data.rarity || data.card_rarity || "-",
      reward:
        data.reward ||
        data.rewardText ||
        data.reward_name ||
        "",
      collection:
        data.collection ||
        data.collectionName ||
        data.set_name ||
        data.reward_set ||
        "",
      collectionReward:
        data.collectionReward ||
        data.collection_reward ||
        data.set_reward ||
        "",
    };
  };

  const captureAndScan = async () => {
  if (isProcessing) return;

  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    if (!videoRef.current) {
      setStatus("❌ ไม่พบกล้อง");
      return;
    }

    const video = videoRef.current;

    if (!video.videoWidth || !video.videoHeight) {
      setStatus("❌ กล้องยังไม่พร้อม");
      return;
    }

    setIsProcessing(true);
    setCard(null);
    setStatus("📸 กำลังจับภาพ...");

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const cropWidth = video.videoWidth * 0.44;
    const cropHeight = cropWidth * 1.25;

    const sx = (video.videoWidth - cropWidth) / 2;
    const sy = (video.videoHeight - cropHeight) / 2;

    canvas.width = 960;
    canvas.height = 1200;

    ctx?.drawImage(
      video,
      sx,
      sy,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const imageData = canvas.toDataURL("image/jpeg", 0.95);

    setStatus("🧠 AI กำลังวิเคราะห์...");

    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch("/api/scan-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image: imageData }),
      signal: controller.signal,
      cache: "no-store",
    });

    const raw = await res.text();

    let ai: any = null;

    try {
      ai = JSON.parse(raw);
    } catch {
      setStatus("❌ AI ตอบผิดรูปแบบ ลองใหม่");
      return;
    }

    if (!res.ok || !ai?.cardNo) {
      setStatus("❌ AI อ่านไม่เจอ");
      return;
    }

    // ⚡ FAST MODE: ไม่ดึงชีท
    setCard({
      cardNo: ai.cardNo,
      cardName: `NEXORA CARD ${ai.cardNo}`,
      rarity: "⚡ FAST AI MODE",
      reward: "",
      collection: "",
      collectionReward: "",
    });

    setStatus(`⚡ พบการ์ด ${ai.cardNo} แบบเร็ว`);
  } catch (e: any) {
    console.error(e);
    setStatus(
      e?.name === "AbortError"
        ? "⏳ AI ใช้เวลานานเกินไป ลองใหม่"
        : `❌ ${e?.message || "สแกนไม่สำเร็จ"}`
    );
  } finally {
    if (timeout) clearTimeout(timeout);
    setIsProcessing(false);
  }
};

  return (
    <div className="relative h-screen overflow-hidden bg-black text-white">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/80" />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[54vh] w-[74vw] max-w-sm rounded-[2.4rem] border-4 border-yellow-300/90 shadow-[0_0_60px_rgba(234,179,8,0.35)]" />
      </div>

      <div className="absolute left-1/2 top-4 z-20 w-[92vw] max-w-md -translate-x-1/2 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-center text-sm font-medium backdrop-blur-md">
        {status}
      </div>

      {card && (
        <div className="absolute bottom-28 left-1/2 z-20 w-[92vw] max-w-md -translate-x-1/2 rounded-[1.6rem] border border-yellow-400/25 bg-black/78 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold tracking-[0.22em] text-yellow-300">
                CARD #{card.cardNo}
              </div>
              <div className="mt-1 text-xl font-black leading-tight">
                {card.cardName}
              </div>
              <div className="mt-1 text-sm text-zinc-300">
                ✨ {card.rarity || "-"}
              </div>
            </div>

            <div className="rounded-xl bg-yellow-500/12 px-3 py-2 text-right">
              <div className="text-[10px] tracking-[0.16em] text-yellow-200/80">
                SCAN
              </div>
              <div className="text-lg font-black text-yellow-300">
                SUCCESS
              </div>
            </div>
          </div>

          {(card.collection || card.collectionReward || card.reward) && (
            <div className="mt-4 space-y-3">
              {card.collection && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[11px] font-bold tracking-[0.18em] text-zinc-400">
                    ชุดสะสม
                  </div>
                  <div className="mt-1 text-base font-bold text-white">
                    {card.collection}
                  </div>
                </div>
              )}

              {card.collectionReward && (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                  <div className="text-[11px] font-bold tracking-[0.18em] text-emerald-200/80">
                    รางวัลของชุดนี้
                  </div>
                  <div className="mt-1 text-sm leading-6 text-emerald-50">
                    🎁 {card.collectionReward}
                  </div>
                </div>
              )}

              {card.reward && (
                <div className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-3">
                  <div className="text-[11px] font-bold tracking-[0.18em] text-yellow-200/80">
                    รางวัลที่เกี่ยวข้อง
                  </div>
                  <div className="mt-1 text-sm leading-6 text-yellow-50">
                    🏆 {card.reward}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
        <button
          onClick={captureAndScan}
          disabled={isProcessing || !cameraReady}
          className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/90 bg-white text-4xl text-black shadow-[0_20px_80px_rgba(255,255,255,0.35)] active:scale-95 disabled:opacity-60"
        >
          {isProcessing ? "⏳" : "📸"}
        </button>
      </div>
    </div>
  );
}