"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  LoaderCircle,
  ScanSearch,
  Sparkles,
  Trophy,
} from "lucide-react";

type CardData = {
  cardNo: string;
  cardName: string;
  rarity?: string;
  reward?: string;
  collection?: string;
  collectionReward?: string;
};

type ScanSource = "local" | "ai" | "hybrid";

type ScanResult = {
  cardNo: string | null;
  confidence?: number;
  score?: number;
  source?: ScanSource;
  error?: string;
};

function formatConfidence(value?: number) {
  const safe = Number(value || 0);
  return `${Math.max(0, Math.min(99, Math.round(safe)))}%`;
}

function safeCardImage(cardNo?: string | null) {
  const value = String(cardNo || "001").padStart(3, "0");
  return `/cards/${value}.jpg`;
}

export default function CardScannerPanel({
  mode = "embedded",
}: {
  mode?: "embedded" | "full";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState("จัดการ์ดให้อยู่ในกรอบ แล้วแตะปุ่มสแกน");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanSource, setScanSource] = useState<ScanSource | null>(null);
  const [scanConfidence, setScanConfidence] = useState<number>(0);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("อุปกรณ์นี้ไม่รองรับการเปิดกล้องในเบราว์เซอร์");
      }

      const attempts: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        },
        {
          video: {
            facingMode: "environment",
          },
          audio: false,
        },
        {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        {
          video: true,
          audio: false,
        },
      ];

      let stream: MediaStream | null = null;
      let lastError: unknown = null;

      for (const constraints of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!stream) {
        throw lastError || new Error("ไม่พบกล้องที่พร้อมใช้งาน");
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
      setStatus("พร้อมแล้ว แตะสแกนเพื่อให้ระบบตรวจจับการ์ดทันที");
    } catch (error: unknown) {
      const isExpectedCameraError =
        error instanceof DOMException &&
        ["NotFoundError", "NotAllowedError", "NotReadableError"].includes(
          error.name
        );

      if (!isExpectedCameraError) {
        console.error(error);
      }

      const message =
        error instanceof DOMException
          ? error.name === "NotFoundError"
            ? "ไม่พบกล้องในอุปกรณ์นี้ หรือเบราว์เซอร์เลือกกล้องที่ไม่มีอยู่แล้ว"
            : error.name === "NotAllowedError"
              ? "ยังไม่ได้อนุญาตสิทธิ์กล้อง กรุณาเปิดสิทธิ์กล้องแล้วลองใหม่"
              : error.name === "NotReadableError"
                ? "กล้องกำลังถูกใช้งานโดยแอปอื่นอยู่ กรุณาปิดแอปกล้องอื่นก่อน"
                : error.message || "เปิดกล้องไม่สำเร็จ"
          : error instanceof Error
            ? error.message
            : "เปิดกล้องไม่สำเร็จ กรุณาลองใหม่";

      setStatus(message);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void startCamera();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      stopCamera();
    };
  }, []);

  const getCardFromSheet = async (cardNo: string): Promise<CardData> => {
    const res = await fetch(`/api/card?cardNo=${encodeURIComponent(cardNo)}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        cardNo,
        cardName: `Card ${cardNo}`,
        rarity: "-",
      };
    }

    const data = await res.json();

    return {
      cardNo: data.cardNo || data.card_no || cardNo,
      cardName: data.cardName || data.card_name || data.name || `Card ${cardNo}`,
      rarity: data.rarity || data.card_rarity || "-",
      reward: data.reward || data.rewardText || data.reward_name || "",
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

  const captureBlob = async () => {
    const video = videoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      throw new Error("กล้องยังไม่พร้อม");
    }

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

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (file) => {
          if (file) {
            resolve(file);
            return;
          }
          reject(new Error("สร้างภาพสำหรับสแกนไม่สำเร็จ"));
        },
        "image/jpeg",
        0.9
      );
    });

    return blob;
  };

  const postScan = async (url: string, blob: Blob, timeoutMs: number) => {
    const formData = new FormData();
    formData.append("file", new File([blob], "scan.jpg", { type: blob.type }));

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        body: formData,
        cache: "no-store",
        signal: controller.signal,
      });

      const text = await res.text();
      const data = JSON.parse(text) as ScanResult;

      if (!res.ok) {
        throw new Error(data.error || "scan failed");
      }

      return data;
    } finally {
      window.clearTimeout(timer);
    }
  };

  const captureAndScan = async () => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);
      setCard(null);
      setScanSource(null);
      setScanConfidence(0);
      setStatus("กำลังจับภาพการ์ด...");

      const blob = await captureBlob();

      setStatus("กำลังสแกนรอบเร็ว...");
      const localResult = await postScan("/api/scan-live", blob, 3500).catch(
        () => null
      );

      if (localResult?.cardNo && Number(localResult.confidence || 0) >= 82) {
        setScanSource("local");
        setScanConfidence(Number(localResult.confidence || 0));
        setStatus(`พบการ์ด ${localResult.cardNo} แล้ว กำลังโหลดข้อมูล...`);

        const sheetCard = await getCardFromSheet(localResult.cardNo);
        setCard(sheetCard);
        setStatus(`สแกนสำเร็จ: ${sheetCard.cardName}`);
        return;
      }

      setStatus("กำลังใช้ AI วิเคราะห์ละเอียด...");
      const aiResult = await postScan("/api/scan-ai", blob, 9000);

      if (!aiResult?.cardNo) {
        throw new Error(aiResult?.error || "ระบบยังระบุการ์ดไม่ได้");
      }

      setScanSource(localResult?.cardNo ? "hybrid" : "ai");
      setScanConfidence(Number(aiResult.confidence || localResult?.confidence || 0));
      setStatus(`พบการ์ด ${aiResult.cardNo} แล้ว กำลังโหลดข้อมูล...`);

      const sheetCard = await getCardFromSheet(aiResult.cardNo);
      setCard(sheetCard);
      setStatus(`สแกนสำเร็จ: ${sheetCard.cardName}`);
    } catch (error: unknown) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "สแกนไม่สำเร็จ ลองจัดแสงและถือการ์ดให้นิ่งขึ้น";
      setStatus(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const isFull = mode === "full";

  return (
    <div
      className={`relative overflow-hidden ${
        isFull
          ? "h-[calc(100dvh-74px)] min-h-[640px] rounded-none"
          : "rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(14,15,20,0.98),rgba(12,13,18,0.94))] shadow-[0_25px_90px_rgba(0,0,0,0.38)]"
      }`}
    >
      <div
        className={`relative ${
          isFull ? "h-full" : "min-h-[680px] md:min-h-[760px] xl:min-h-[720px]"
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.62),rgba(0,0,0,0.1)_34%,rgba(0,0,0,0.72)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.18),transparent_28%),radial-gradient(circle_at_bottom,rgba(34,211,238,0.1),transparent_26%)]" />

        <div className="absolute left-1/2 top-4 z-20 w-[92%] max-w-xl -translate-x-1/2 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-center text-sm font-medium backdrop-blur-md sm:text-base">
          {status}
        </div>

        {!isFull && (
          <div className="absolute left-4 top-20 z-20 max-w-[360px] rounded-[24px] border border-white/8 bg-black/35 p-4 backdrop-blur-xl sm:left-5 sm:top-24 sm:p-5">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300">
              <ScanSearch className="h-4 w-4" />
              NEXORA SCAN SYSTEM
            </div>
            <h2 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">
              สแกนการ์ดสะสม
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/65 sm:text-base">
              วางการ์ดให้อยู่ในกรอบแล้วกดสแกน ระบบจะตรวจแบบรอบเร็วในเครื่องก่อน
              และค่อยใช้ AI ต่อเมื่อจำเป็น เพื่อให้เร็วและแม่นขึ้นพร้อมกัน
            </p>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <div className="relative h-[52vh] max-h-[520px] w-[72vw] max-w-[360px] rounded-[2.6rem] border-[3px] border-amber-300/90 shadow-[0_0_60px_rgba(251,191,36,0.32)]">
            <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/90 to-transparent" />
            <div className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-300/90 to-transparent" />
          </div>
        </div>

        {card && (
          <div className="absolute bottom-28 left-1/2 z-20 w-[92%] max-w-xl -translate-x-1/2 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,10,12,0.92),rgba(15,18,25,0.92))] p-4 shadow-[0_25px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-5">
            <div className="flex items-start gap-4">
              <div className="relative aspect-[2/3] w-24 overflow-hidden rounded-2xl border border-white/10 shadow-xl sm:w-28">
                <Image
                  src={safeCardImage(card.cardNo)}
                  alt={card.cardName}
                  fill
                  sizes="(max-width: 640px) 96px, 112px"
                  className="object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">
                    CARD #{String(card.cardNo).padStart(3, "0")}
                  </div>
                  <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
                    {scanSource === "local"
                      ? `FAST SCAN ${formatConfidence(scanConfidence)}`
                      : scanSource === "hybrid"
                        ? `HYBRID AI ${formatConfidence(scanConfidence)}`
                        : `AI SCAN ${formatConfidence(scanConfidence)}`}
                  </div>
                </div>

                <div className="mt-3 text-xl font-black leading-tight text-white sm:text-2xl">
                  {card.cardName}
                </div>
                <div className="mt-2 text-sm text-zinc-300 sm:text-base">
                  ความหายาก: {card.rarity || "-"}
                </div>

                {(card.collection || card.collectionReward || card.reward) && (
                  <div className="mt-4 space-y-3">
                    {card.collection && (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                        <div className="text-[11px] font-bold tracking-[0.16em] text-zinc-400">
                          ชุดสะสม
                        </div>
                        <div className="mt-1 text-sm font-bold text-white sm:text-base">
                          {card.collection}
                        </div>
                      </div>
                    )}

                    {card.collectionReward && (
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-emerald-200/85">
                          <Sparkles className="h-3.5 w-3.5" />
                          รางวัลของชุดนี้
                        </div>
                        <div className="mt-1 text-sm leading-6 text-emerald-50">
                          {card.collectionReward}
                        </div>
                      </div>
                    )}

                    {card.reward && (
                      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3">
                        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-amber-200/85">
                          <Trophy className="h-3.5 w-3.5" />
                          รางวัลที่เกี่ยวข้อง
                        </div>
                        <div className="mt-1 text-sm leading-6 text-amber-50">
                          {card.reward}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
          <button
            onClick={() => void captureAndScan()}
            disabled={isProcessing || !cameraReady}
            className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/90 bg-white text-black shadow-[0_20px_80px_rgba(255,255,255,0.32)] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isProcessing ? (
              <LoaderCircle className="h-10 w-10 animate-spin" />
            ) : cameraReady ? (
              <Camera className="h-10 w-10" />
            ) : (
              <ScanSearch className="h-10 w-10" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
