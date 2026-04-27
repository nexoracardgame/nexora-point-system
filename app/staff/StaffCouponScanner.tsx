"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Loader2,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { CouponViewModel } from "@/components/CouponDetailCard";

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): {
        detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
      };
      getSupportedFormats?: () => Promise<string[]>;
    };
  }
}

export default function StaffCouponScanner() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<CouponViewModel | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanning, setScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCameraSupported(
      typeof window !== "undefined" &&
        "mediaDevices" in navigator &&
        typeof window.BarcodeDetector !== "undefined"
    );
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const statusTone = useMemo(() => {
    if (error) return "error";
    if (message) return "success";
    return "idle";
  }, [error, message]);

  const stopCamera = () => {
    if (scanFrameRef.current) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setScanning(false);
  };

  useEffect(() => stopCamera, []);

  const submitCoupon = async (manualCode?: string) => {
    const nextCode = String(manualCode || code).trim();

    if (!nextCode) {
      setError("กรุณากรอกรหัสหรือยิงสแกนคูปองก่อน");
      setMessage("");
      setResult(null);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const res = await fetch("/api/coupon/use", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: nextCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(String(data?.error || "ยืนยันคูปองไม่สำเร็จ"));
        setResult(data?.coupon || null);
        return;
      }

      setMessage(String(data?.message || "ใช้คูปองสำเร็จ"));
      setResult(data?.coupon || null);
      setCode("");
      inputRef.current?.focus();
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างเชื่อมต่อระบบ");
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    if (!cameraSupported || !videoRef.current) {
      setCameraError("อุปกรณ์นี้ยังไม่รองรับการสแกนผ่านกล้อง");
      return;
    }

    try {
      setCameraError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: "environment",
          },
        },
        audio: false,
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraOpen(true);
      setScanning(true);

      const Detector = window.BarcodeDetector;

      if (!Detector) {
        setCameraError("อุปกรณ์นี้ยังไม่รองรับการสแกนผ่านกล้อง");
        stopCamera();
        return;
      }

      const detector = new Detector({
        formats: ["qr_code"],
      });

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;

        try {
          const codes = await detector.detect(videoRef.current);
          const found = codes.find((item) => String(item.rawValue || "").trim());

          if (found?.rawValue) {
            const detectedCode = String(found.rawValue).trim();
            setCode(detectedCode);
            stopCamera();
            void submitCoupon(detectedCode);
            return;
          }
        } catch {
          return;
        }

        scanFrameRef.current = requestAnimationFrame(() => {
          void tick();
        });
      };

      scanFrameRef.current = requestAnimationFrame(() => {
        void tick();
      });
    } catch {
      setCameraError("ไม่สามารถเปิดกล้องเพื่อสแกนได้");
      stopCamera();
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#181222_0%,#090a11_42%,#04050a_100%)] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.1),transparent_28%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-6 xl:px-6">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,19,29,0.96),rgba(10,12,20,0.96))] p-4 shadow-[0_25px_120px_rgba(0,0,0,0.45)] sm:p-6 xl:p-8">
          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/18 bg-amber-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-amber-200 sm:text-xs">
                <ShieldCheck className="h-3.5 w-3.5" />
                STAFF COUPON SCAN
              </div>

              <h1 className="mt-4 text-3xl font-black sm:text-4xl xl:text-5xl">
                ยิงสแกนคูปอง แล้วอัปเดตสถานะใช้งานทันที
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 sm:text-base sm:leading-7">
                ใช้ได้ทั้งเครื่องสแกนบาร์โค้ดที่พิมพ์รหัสเข้าช่องนี้ และมือถือที่เปิดกล้องยิง QR โดยตรง
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[26px] border border-white/8 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/38">
                  <ScanLine className="h-3.5 w-3.5 text-cyan-300" />
                  โหมดสแกน
                </div>
                <div className="mt-2 text-xl font-black text-white">
                  {cameraOpen ? "กล้องกำลังทำงาน" : "พร้อมรับโค้ด"}
                </div>
              </div>

              <div className="rounded-[26px] border border-white/8 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/38">
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  สถานะล่าสุด
                </div>
                <div
                  className={`mt-2 text-xl font-black ${
                    statusTone === "success"
                      ? "text-emerald-300"
                      : statusTone === "error"
                        ? "text-red-300"
                        : "text-white"
                  }`}
                >
                  {statusTone === "success"
                    ? "ผ่านแล้ว"
                    : statusTone === "error"
                      ? "ต้องตรวจสอบ"
                      : "รอสแกน"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,16,25,0.96),rgba(9,11,18,0.96))] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 text-lg font-black">
              <QrCode className="h-5 w-5 text-cyan-300" />
              สแกนหรือกรอกรหัสคูปอง
            </div>

            <div className="mt-4 space-y-3">
              <input
                ref={inputRef}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitCoupon();
                  }
                }}
                placeholder="วางหรือยิงรหัสคูปองตรงนี้"
                className="w-full rounded-[22px] border border-white/10 bg-black/25 px-4 py-4 text-base font-bold text-white outline-none transition focus:border-amber-300/30 focus:ring-2 focus:ring-amber-300/12"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void submitCoupon()}
                  disabled={loading}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[22px] bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-4 py-3 text-sm font-black text-black shadow-[0_0_24px_rgba(250,204,21,0.26)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  ยืนยันใช้คูปอง
                </button>

                <button
                  type="button"
                  onClick={() => void startCamera()}
                  disabled={!cameraSupported || cameraOpen}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[22px] border border-cyan-300/18 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Camera className="h-4 w-4" />
                  เปิดกล้องสแกน
                </button>
              </div>
            </div>

            {cameraError ? (
              <div className="mt-4 rounded-[20px] border border-red-400/18 bg-red-500/10 p-4 text-sm text-red-200">
                {cameraError}
              </div>
            ) : null}

            {cameraOpen ? (
              <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-black/35">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="flex items-center justify-between gap-3 border-t border-white/8 px-4 py-3 text-sm text-white/60">
                  <span>{scanning ? "กำลังหาคิวอาร์..." : "เตรียมสแกน"}</span>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 font-bold text-white"
                  >
                    ปิดกล้อง
                  </button>
                </div>
              </div>
            ) : null}

            {message ? (
              <div className="mt-4 flex items-start gap-3 rounded-[22px] border border-emerald-400/18 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4" />
                <span>{message}</span>
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 flex items-start gap-3 rounded-[22px] border border-red-400/18 bg-red-500/10 p-4 text-sm text-red-200">
                <XCircle className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>

          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,16,25,0.96),rgba(9,11,18,0.96))] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 text-lg font-black">
              <Sparkles className="h-5 w-5 text-amber-300" />
              รายละเอียดคูปองล่าสุด
            </div>

            {result ? (
              <div className="mt-4 grid gap-4">
                <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                    รางวัล
                  </div>
                  <div className="mt-2 text-2xl font-black">{result.rewardName}</div>
                  <div className="mt-1 text-sm text-white/55">{result.valueLabel}</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                      ผู้แลก
                    </div>
                    <div className="mt-2 text-base font-black">{result.userName}</div>
                  </div>

                  <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                      สถานะ
                    </div>
                    <div
                      className={`mt-2 text-base font-black ${
                        result.used ? "text-white/70" : "text-emerald-300"
                      }`}
                    >
                      {result.statusLabel}
                    </div>
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                    รหัสคูปอง
                  </div>
                  <div className="mt-2 break-all text-sm font-black text-white/88">
                    {result.code}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                      สร้างเมื่อ
                    </div>
                    <div className="mt-2 text-sm font-bold text-white/75">
                      {new Intl.DateTimeFormat("th-TH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(result.createdAt))}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                      ใช้งานเมื่อ
                    </div>
                    <div className="mt-2 text-sm font-bold text-white/75">
                      {result.usedAt
                        ? new Intl.DateTimeFormat("th-TH", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(result.usedAt))
                        : "-"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm leading-6 text-white/48">
                ยิงสแกนคูปองหรือกรอกรหัสเพื่อดูข้อมูลและอัปเดตสถานะการใช้งาน
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
