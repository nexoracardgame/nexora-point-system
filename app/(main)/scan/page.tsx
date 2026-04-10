"use client";

import { useEffect, useRef, useState } from "react";

type CardData = {
  cardNo: string;
  cardName: string;
  rarity: string;
  reward?: string;
};

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentDeviceIdRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState("📸 เล็งการ์ดให้เต็มกรอบ แล้วแตะปุ่มแชะ");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  useEffect(() => {
    fetch("/api/scan-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "warmup" }),
    }).catch(() => {});

    loadDevices().then(() => startCamera());
    return () => stopCamera();
  }, []);

  const loadDevices = async () => {
    try {
      const temp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      temp.getTracks().forEach((t) => t.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices.filter((d) => d.kind === "videoinput");
      setCameraDevices(videos);
      if (videos[0] && !selectedDeviceId) {
        setSelectedDeviceId(videos[0].deviceId);
      }
    } catch {}
  };

  const startCamera = async (forcedDeviceId?: string) => {
    try {
      let stream: MediaStream;
      const deviceId = forcedDeviceId || selectedDeviceId || currentDeviceIdRef.current;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? {
                deviceId: { exact: deviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              }
            : {
                facingMode: { ideal: "environment" },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      currentDeviceIdRef.current = deviceId || null;
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setCameraReady(true);
      setStatus("📸 พร้อมสแกน แตะปุ่มครั้งเดียวแล้วรอข้อมูลเด้งขึ้น");
    } catch (error) {
      console.error(error);
      setStatus("❌ เปิดกล้องไม่ได้ กรุณาอนุญาตสิทธิ์กล้อง");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const captureAndScan = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady || isProcessing) return;

    setIsProcessing(true);
    setCard(null);
    setStatus("🧠 AI กำลังวิเคราะห์...");

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas error");

      const cropWidth = video.videoWidth * 0.62;
      const cropHeight = cropWidth * 1.35;
      const sx = (video.videoWidth - cropWidth) / 2;
      const sy = (video.videoHeight - cropHeight) / 2;

      canvas.width = 720;
      canvas.height = 972;

      ctx.drawImage(
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

      const image = canvas.toDataURL("image/jpeg", 0.86);

      const aiRes = await fetch("/api/scan-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });

      const raw = await aiRes.text();
      if (!aiRes.ok) throw new Error(raw || "AI server failed");

      const ai = JSON.parse(raw);
      if (!ai.cardNo) {
        setStatus("❌ AI อ่านไม่ออก ขยับให้เต็มกรอบอีกนิด");
        return;
      }

      setCard({
        cardNo: ai.cardNo,
        cardName: ai.card_name || ai.cardName || "Unknown Card",
        rarity: ai.rarity || "-",
        reward: ai.reward,
      });

      setStatus(`🃏 พบการ์ด ${ai.cardNo} • ${Math.round((ai.confidence || 0) * 100)}%`);
    } catch (error) {
      console.error(error);
      setStatus("❌ AI วิเคราะห์ไม่สำเร็จ");
    } finally {
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

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[52vh] w-[72vw] max-w-sm rounded-[2.5rem] border-4 border-yellow-300/90 shadow-[0_0_60px_rgba(234,179,8,0.35)]" />
      </div>

      <div className="absolute left-0 right-0 top-0 p-4">
        <div className="mx-auto max-w-md rounded-2xl bg-black/35 px-4 py-3 text-center text-sm backdrop-blur-md">
          {status}
        </div>
      </div>

      {card && (
        <div className="absolute bottom-28 left-1/2 z-20 w-[92vw] max-w-md -translate-x-1/2 rounded-[2rem] border border-yellow-400/30 bg-black/75 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl animate-in slide-in-from-bottom-8 duration-300">
          <div className="text-xs tracking-[0.2em] text-yellow-300">CARD #{card.cardNo}</div>
          <div className="mt-1 text-2xl font-black leading-tight">{card.cardName}</div>
          <div className="mt-2 text-sm text-zinc-300">✨ {card.rarity}</div>
          {card.reward && (
            <div className="mt-4 rounded-2xl bg-yellow-500/10 p-3 text-sm text-yellow-50">
              🎁 {card.reward}
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-24 right-4 z-30 flex flex-col gap-2">
        {cameraDevices.length > 1 && (
          <select
            value={selectedDeviceId}
            onChange={(e) => {
              const next = e.target.value;
              setSelectedDeviceId(next);
              stopCamera();
              startCamera(next);
            }}
            className="rounded-2xl border border-white/20 bg-black/60 px-3 py-2 text-xs text-white backdrop-blur"
          >
            {cameraDevices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Lens ${index + 1}`}
              </option>
            ))}
          </select>
        )}
      </div>

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
