"use client";

import jsQR from "jsqr";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { extractCardRareCode } from "@/lib/card-rare-code";
import { extractCardSetCode } from "@/lib/card-set-code";
import { nexoraAlert, nexoraConfirm } from "@/lib/nexora-dialog";
import { formatThaiDateTime } from "@/lib/thai-time";

const COUPON_CODE_PATTERN = /NXR-(NEX|COIN)-\d+-\d{10,}-[A-Z0-9]{4,16}/i;

type StaffCouponScannerProps = {
  embedded?: boolean;
};

type LookupOptions = {
  promptUse?: boolean;
};

type CardSetScanView = {
  id: string;
  code: string;
  userId: string;
  userName: string;
  lineId: string;
  setOrder: number;
  setName: string;
  rewardLabel: string;
  redemptionType:
    | "standard"
    | "foil_bonus"
    | "foil_sequence_1"
    | "foil_sequence_9"
    | "foil_sequence_18";
  conditionLabel: string | null;
  valueLabel: string;
  status: "pending" | "approved" | "cancelled" | "expired";
  statusLabel: string;
  createdAt: string;
  expiresAt: string;
  approvedAt: string | null;
};

type CardRareScanView = {
  id: string;
  code: string;
  userId: string;
  userName: string;
  lineId: string;
  cardNo: string;
  cardName: string;
  rewardLabel: string;
  optionKey: string;
  conditionLabel: string | null;
  valueLabel: string;
  status: "pending" | "approved" | "cancelled" | "expired";
  statusLabel: string;
  createdAt: string;
  expiresAt: string;
  approvedAt: string | null;
};

function waitForPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function extractCouponCode(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const candidates = new Set<string>([raw]);

  try {
    candidates.add(decodeURIComponent(raw));
  } catch {}

  for (const candidate of Array.from(candidates)) {
    try {
      const url = new URL(candidate);
      candidates.add(url.pathname);
      candidates.add(url.search);

      for (const key of ["code", "coupon", "open"]) {
        const param = url.searchParams.get(key);
        if (param) {
          candidates.add(param);
        }
      }

      url.pathname
        .split("/")
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => candidates.add(part));
    } catch {}
  }

  for (const candidate of candidates) {
    const match = candidate.toUpperCase().match(COUPON_CODE_PATTERN);
    if (match?.[0]) {
      return match[0];
    }
  }

  return "";
}

function normalizeCouponInput(value?: string | null) {
  const raw = String(value || "").trim();
  return extractCardRareCode(raw) || extractCardSetCode(raw) || extractCouponCode(raw) || raw;
}

function extractScanCode(value?: string | null) {
  return extractCardRareCode(value) || extractCardSetCode(value) || extractCouponCode(value);
}

function getLookupError(status: number) {
  if (status === 403) return "บัญชีนี้ไม่มีสิทธิ์ตรวจสอบคูปอง";
  if (status === 404) return "ไม่พบคูปองนี้ในระบบ";
  return "ตรวจสอบคูปองไม่สำเร็จ";
}

function getUseError(status: number) {
  if (status === 403) return "บัญชีนี้ไม่มีสิทธิ์ยืนยันคูปอง";
  if (status === 404) return "ไม่พบคูปองนี้ในระบบ";
  if (status === 409) return "คูปองใบนี้ถูกใช้งานไปแล้ว";
  return "ยืนยันคูปองไม่สำเร็จ";
}

function showRedeemSuccess(label: string) {
  void nexoraAlert({
    title: "การแลกเสร็จสมบูรณ์",
    message: label,
    tone: "success",
    confirmText: "เรียบร้อย",
  });
}

export default function StaffCouponScanner({
  embedded = false,
}: StaffCouponScannerProps = {}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<CouponViewModel | null>(null);
  const [cardSetResult, setCardSetResult] = useState<CardSetScanView | null>(
    null
  );
  const [cardRareResult, setCardRareResult] = useState<CardRareScanView | null>(
    null
  );
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraAvailable, setCameraAvailable] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const lastScannedCodeRef = useRef("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCameraAvailable(
      typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia),
    );
    inputRef.current?.focus();
  }, []);

  const statusTone = useMemo(() => {
    if (error) return "error";
    if (message) return "success";
    return "idle";
  }, [error, message]);

  const stopCamera = useCallback(async () => {
    if (scanFrameRef.current != null) {
      window.cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }

    const stream = streamRef.current;
    streamRef.current = null;
    setCameraOpen(false);

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  const confirmCouponUse = useCallback(
    async (targetCode?: string) => {
      const nextCode = normalizeCouponInput(targetCode || result?.code || code);
      if (!nextCode) return;

      try {
        setLoading(true);
        setError("");
        setMessage("");

        const res = await fetch("/api/coupon/use", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: nextCode }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(String(data?.error || getUseError(res.status)));
          if (data?.coupon) {
            setResult(data.coupon);
          }
          return;
        }

        setMessage("การแลกเสร็จสมบูรณ์");
        setResult(data?.coupon || null);
        setCardSetResult(null);
        setCardRareResult(null);
        setCode(nextCode);
        showRedeemSuccess(
          data?.coupon?.rewardName
            ? `ยืนยันใช้คูปอง ${data.coupon.rewardName} สำเร็จ`
            : "ยืนยันใช้คูปองสำเร็จ"
        );
        inputRef.current?.focus();
      } catch {
        setError("เกิดข้อผิดพลาดระหว่างยืนยันใช้งานคูปอง");
      } finally {
        setLoading(false);
      }
    },
    [code, result?.code],
  );

  const confirmCardSetAction = useCallback(
    async (action: "approve" | "cancel", targetCode?: string) => {
      const nextCode = normalizeCouponInput(targetCode || cardSetResult?.code || code);
      if (!nextCode) return;

      try {
        setLoading(true);
        setError("");
        setMessage("");

        const res = await fetch(
          `/api/card-set-redemptions/${encodeURIComponent(nextCode)}/action`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          }
        );
        const data = await res.json();

        if (!res.ok) {
          setError(String(data?.error || "อัปเดตรายการแลกเซ็ตไม่สำเร็จ"));
          if (data?.redemption) {
            setCardSetResult(data.redemption);
          }
          return;
        }

        setCardSetResult(data?.redemption || null);
        setResult(null);
        setCode(nextCode);
        if (action === "approve") {
          setMessage("การแลกเสร็จสมบูรณ์");
          showRedeemSuccess(
            `อนุมัติ CARD SET ${data?.redemption?.setOrder || ""} ${
              data?.redemption?.setName || ""
            } สำเร็จ`.trim()
          );
        }
        setMessage(
          action === "approve"
            ? "การแลกเสร็จสมบูรณ์"
            : "ยกเลิกรายการแลก CARD SET แล้ว"
        );
      } catch {
        setError("เกิดข้อผิดพลาดระหว่างอัปเดตรายการแลกเซ็ต");
      } finally {
        setLoading(false);
      }
    },
    [cardSetResult?.code, code]
  );

  const confirmCardRareAction = useCallback(
    async (action: "approve" | "cancel", targetCode?: string) => {
      const nextCode = normalizeCouponInput(targetCode || cardRareResult?.code || code);
      if (!nextCode) return;

      try {
        setLoading(true);
        setError("");
        setMessage("");

        const res = await fetch(
          `/api/card-rare-redemptions/${encodeURIComponent(nextCode)}/action`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          }
        );
        const data = await res.json();

        if (!res.ok) {
          setError(String(data?.error || "อัปเดตรายการแลก CARD RARE ไม่สำเร็จ"));
          if (data?.redemption) {
            setCardRareResult(data.redemption);
          }
          return;
        }

        setCardRareResult(data?.redemption || null);
        setCardSetResult(null);
        setResult(null);
        setCode(nextCode);
        if (action === "approve") {
          setMessage("การแลกเสร็จสมบูรณ์");
          showRedeemSuccess(
            `อนุมัติ CARD RARE No. ${data?.redemption?.cardNo || ""} ${
              data?.redemption?.cardName || ""
            } สำเร็จ`.trim()
          );
        }
        setMessage(
          action === "approve"
            ? "การแลกเสร็จสมบูรณ์"
            : "ยกเลิกรายการแลก CARD RARE แล้ว"
        );
      } catch {
        setError("เกิดข้อผิดพลาดระหว่างอัปเดตรายการแลก CARD RARE");
      } finally {
        setLoading(false);
      }
    },
    [cardRareResult?.code, code]
  );

  const lookupCoupon = useCallback(
    async (manualCode?: string, options: LookupOptions = {}) => {
      const nextCode = normalizeCouponInput(manualCode || code);
      if (!nextCode) {
        setError("กรุณากรอกรหัสหรือยิงสแกนคูปองก่อน");
        setMessage("");
        setResult(null);
        return;
      }

      try {
        setLookupLoading(true);
        setError("");
        setMessage("");

        const cardRareCode = extractCardRareCode(nextCode);
        if (cardRareCode) {
          const res = await fetch(
            `/api/card-rare-redemptions/${encodeURIComponent(cardRareCode)}`,
            { cache: "no-store" }
          );
          const data = await res.json();

          if (!res.ok) {
            setError(getLookupError(res.status));
            setResult(null);
            setCardSetResult(null);
            setCardRareResult(null);
            return;
          }

          setCode(cardRareCode);
          setResult(null);
          setCardSetResult(null);
          setCardRareResult(data?.redemption || null);
          if (options.promptUse) {
            setMessage("สแกน QR CODE CARD RARE สำเร็จ");
          }
          return;
        }

        const cardSetCode = extractCardSetCode(nextCode);
        if (cardSetCode) {
          const res = await fetch(
            `/api/card-set-redemptions/${encodeURIComponent(cardSetCode)}`,
            { cache: "no-store" }
          );
          const data = await res.json();

          if (!res.ok) {
            setError(getLookupError(res.status));
            setResult(null);
            setCardSetResult(null);
            return;
          }

          setCode(cardSetCode);
          setResult(null);
          setCardRareResult(null);
          setCardSetResult(data?.redemption || null);
          if (options.promptUse) {
            setMessage("สแกน QR CODE CARD SET สำเร็จ");
          }
          return;
        }

        const res = await fetch(`/api/coupon/${encodeURIComponent(nextCode)}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok) {
          setError(getLookupError(res.status));
          setResult(null);
          setCardSetResult(null);
          return;
        }

        const coupon = (data?.coupon || null) as CouponViewModel | null;
        setCode(nextCode);
        setResult(coupon);
        setCardSetResult(null);

        if (options.promptUse && coupon) {
          if (coupon.isReversed) {
            setMessage("สแกนสำเร็จ แต่คูปองใบนี้ถูกย้อนกลับแล้ว");
            return;
          }

          if (coupon.used) {
            setMessage("สแกนสำเร็จ แต่คูปองใบนี้ถูกใช้งานไปแล้ว");
            return;
          }

          const confirmed = await nexoraConfirm({
            title: "สแกน QR CODE คูปองสำเร็จ",
            message: `พบคูปอง ${coupon.rewardName} รหัส ${coupon.code} ต้องการยืนยันการใช้งานคูปองนี้เลยไหม`,
            tone: "success",
            confirmText: "ยืนยันใช้งาน",
            cancelText: "ตรวจสอบก่อน",
          });

          if (confirmed) {
            await confirmCouponUse(coupon.code);
          } else {
            setMessage("สแกน QR CODE คูปองสำเร็จ");
          }
        }
      } catch {
        setError("เกิดข้อผิดพลาดระหว่างโหลดข้อมูลคูปอง");
        setResult(null);
        setCardSetResult(null);
      } finally {
        setLookupLoading(false);
      }
    },
    [code, confirmCouponUse],
  );

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const stream = streamRef.current;

    if (!video || !canvas || !stream) return;

    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      const width = video.videoWidth;
      const height = video.videoHeight;
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) {
        context.drawImage(video, 0, 0, width, height);
        const imageData = context.getImageData(0, 0, width, height);
        const qr = jsQR(imageData.data, width, height, {
          inversionAttempts: "attemptBoth",
        });
        const detectedCode = extractScanCode(qr?.data);

        if (detectedCode && detectedCode !== lastScannedCodeRef.current) {
          lastScannedCodeRef.current = detectedCode;
          setCode(detectedCode);
          setCameraError("");
          void stopCamera().then(() => {
            void lookupCoupon(detectedCode, { promptUse: true });
          });
          return;
        }
      }
    }

    scanFrameRef.current = window.requestAnimationFrame(scanFrame);
  }, [lookupCoupon, stopCamera]);

  const startCamera = useCallback(async () => {
    if (!cameraAvailable) {
      setCameraError("อุปกรณ์นี้ไม่รองรับการเปิดกล้อง หรือหน้านี้ไม่ได้เปิดผ่าน HTTPS");
      return;
    }

    try {
      await stopCamera();
      lastScannedCodeRef.current = "";
      setCameraError("");
      setError("");
      setMessage("");
      setCameraOpen(true);
      await waitForPaint();

      const attempts: MediaStreamConstraints[] = [
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        {
          audio: false,
          video: { facingMode: "environment" },
        },
        {
          audio: false,
          video: true,
        },
      ];

      let stream: MediaStream | null = null;
      let lastError: unknown = null;

      for (const constraints of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!stream) {
        throw lastError || new Error("camera_unavailable");
      }

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error("video_not_ready");
      }

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "true");

      await video.play().catch(() => undefined);

      if (!video.videoWidth) {
        await new Promise<void>((resolve) => {
          const timeout = window.setTimeout(resolve, 900);
          video.onloadedmetadata = () => {
            window.clearTimeout(timeout);
            resolve();
          };
        });
        await video.play().catch(() => undefined);
      }

      scanFrameRef.current = window.requestAnimationFrame(scanFrame);
    } catch (err) {
      console.error("STAFF_CAMERA_START_ERROR", err);
      const denied = err instanceof DOMException && err.name === "NotAllowedError";
      const notFound = err instanceof DOMException && err.name === "NotFoundError";

      setCameraError(
        denied
          ? "ยังไม่ได้อนุญาตสิทธิ์กล้อง กรุณาอนุญาตกล้องแล้วลองเปิดใหม่"
          : notFound
            ? "ไม่พบกล้องในอุปกรณ์นี้ กรุณากรอกรหัสคูปองแทน"
            : "ไม่สามารถเปิดกล้องสแกนได้ กรุณาลองใหม่หรือกรอกรหัสคูปองแทน",
      );
      await stopCamera();
    }
  }, [cameraAvailable, scanFrame, stopCamera]);

  return (
    <div
      className={
        embedded
          ? "relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,#181222_0%,#090a11_42%,#04050a_100%)] p-3 text-white shadow-[0_25px_120px_rgba(0,0,0,0.32)] sm:p-4"
          : "min-h-[var(--app-shell-height)] bg-[radial-gradient(circle_at_top,#181222_0%,#090a11_42%,#04050a_100%)] text-white"
      }
    >
      <div className={`pointer-events-none ${embedded ? "absolute" : "fixed"} inset-0`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.1),transparent_28%)]" />
      </div>

      <div
        className={
          embedded
            ? "relative mx-auto max-w-6xl space-y-5"
            : "relative mx-auto max-w-6xl space-y-5 px-3 py-4 sm:px-5 sm:py-6 xl:px-6"
        }
      >
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,19,29,0.96),rgba(10,12,20,0.96))] p-4 shadow-[0_25px_120px_rgba(0,0,0,0.45)] sm:p-6 xl:p-8">
          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/18 bg-amber-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-amber-200 sm:text-xs">
                <ShieldCheck className="h-3.5 w-3.5" />
                STAFF COUPON SCAN
              </div>

              <h1 className="mt-4 text-3xl font-black sm:text-4xl xl:text-5xl">
                สแกนคูปอง แล้วกดยืนยันใช้งานจริง
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 sm:text-base sm:leading-7">
                สแกน QR CODE จากคูปองรางวัลใน NEXORA TCG หรือกรอกรหัสคูปองตรงนี้ ระบบจะดึงคูปองจริงขึ้นมาให้ตรวจสอบก่อนใช้งาน
                QR อื่นที่ไม่ใช่คูปองของระบบจะไม่ถูกนำไปใช้
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[26px] border border-white/8 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/38">
                  <ScanLine className="h-3.5 w-3.5 text-cyan-300" />
                  โหมดสแกน
                </div>
                <div className="mt-2 text-xl font-black text-white">
                  {cameraOpen ? "กล้องกำลังทำงาน" : "พร้อมรับคูปอง"}
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
                    ? "พร้อมปิดงาน"
                    : statusTone === "error"
                      ? "ต้องตรวจสอบ"
                      : "รอสแกน"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
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
                    void lookupCoupon();
                  }
                }}
                placeholder="วางหรือยิงรหัสคูปองตรงนี้"
                className="w-full rounded-[22px] border border-white/10 bg-black/25 px-4 py-4 text-base font-bold text-white outline-none transition focus:border-amber-300/30 focus:ring-2 focus:ring-amber-300/12"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void lookupCoupon()}
                  disabled={lookupLoading}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[22px] bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-4 py-3 text-sm font-black text-black shadow-[0_0_24px_rgba(250,204,21,0.26)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {lookupLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  ตรวจสอบคูปอง
                </button>

                <button
                  type="button"
                  onClick={() => void startCamera()}
                  disabled={cameraOpen}
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
                <div className="relative min-h-[320px] w-full overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    autoPlay
                    className="h-full min-h-[320px] w-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-56 w-56 rounded-[28px] border-2 border-cyan-200/80 shadow-[0_0_50px_rgba(34,211,238,0.35)]" />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-white/8 px-4 py-3 text-sm text-white/60">
                  <span>กำลังมองหา QR CODE คูปอง NEXORA TCG...</span>
                  <button
                    type="button"
                    onClick={() => void stopCamera()}
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
              คูปอง / CARD SET ที่สแกนพบ
            </div>

            {cardSetResult ? (
              <div className="mt-4 grid gap-4">
                <div className="rounded-[24px] border border-amber-300/20 bg-amber-300/10 p-4">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-amber-200/75">
                    CARD SET
                  </div>
                  <div className="mt-2 text-2xl font-black">
                    Set {cardSetResult.setOrder} {cardSetResult.setName}
                  </div>
                  <div className="mt-1 text-sm font-bold text-white/60">
                    {cardSetResult.valueLabel}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                      ผู้แลก
                    </div>
                    <div className="mt-2 text-base font-black">
                      {cardSetResult.userName}
                    </div>
                    <div className="mt-1 break-all text-xs font-bold text-white/45">
                      {cardSetResult.lineId}
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                      สถานะ
                    </div>
                    <div
                      className={`mt-2 text-base font-black ${
                        cardSetResult.status === "approved"
                          ? "text-emerald-300"
                          : cardSetResult.status === "pending"
                            ? "text-amber-300"
                            : "text-red-300"
                      }`}
                    >
                      {cardSetResult.statusLabel}
                    </div>
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                    Reward
                  </div>
                  <div className="mt-2 w-fit rounded-full bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-200">
                    {cardSetResult.conditionLabel
                      ? "แบบเงื่อนไขเสริม"
                      : "แบบธรรมดา"}
                  </div>
                  <div className="mt-2 text-sm font-bold text-white/75">
                    {cardSetResult.rewardLabel}
                  </div>
                  {cardSetResult.conditionLabel ? (
                    <div className="mt-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-black text-white/62">
                      {cardSetResult.conditionLabel}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                    Serial Code
                  </div>
                  <div className="mt-2 break-all text-sm font-black text-white/88">
                    {cardSetResult.code}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                      สร้างเมื่อ
                    </div>
                    <div className="mt-2 text-sm font-bold text-white/75">
                      {formatThaiDateTime(cardSetResult.createdAt)}
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                      หมดเวลา
                    </div>
                    <div className="mt-2 text-sm font-bold text-white/75">
                      {formatThaiDateTime(cardSetResult.expiresAt)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void confirmCardSetAction("approve")}
                    disabled={loading || cardSetResult.status !== "pending"}
                    className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[22px] bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-4 py-3 text-sm font-black text-black shadow-[0_0_24px_rgba(250,204,21,0.26)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    อนุมัติ
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmCardSetAction("cancel")}
                    disabled={loading || cardSetResult.status !== "pending"}
                    className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[22px] border border-red-300/18 bg-red-500/10 px-4 py-3 text-sm font-black text-red-200 transition hover:bg-red-500/16 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <XCircle className="h-4 w-4" />
                    ยกเลิก
                  </button>
                </div>
              </div>
            ) : cardRareResult ? (
              <div className="mt-4 grid gap-4">
                <div className="rounded-[24px] border border-violet-300/20 bg-violet-300/10 p-4">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-violet-200/75">
                    CARD RARE
                  </div>
                  <div className="mt-2 text-2xl font-black">
                    No. {cardRareResult.cardNo} {cardRareResult.cardName}
                  </div>
                  <div className="mt-1 text-sm font-bold text-white/60">
                    {cardRareResult.valueLabel}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                      เธเธนเนเนเธฅเธ
                    </div>
                    <div className="mt-2 text-base font-black">
                      {cardRareResult.userName}
                    </div>
                    <div className="mt-1 break-all text-xs font-bold text-white/45">
                      {cardRareResult.lineId}
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                      เธชเธ–เธฒเธเธฐ
                    </div>
                    <div
                      className={`mt-2 text-base font-black ${
                        cardRareResult.status === "approved"
                          ? "text-emerald-300"
                          : cardRareResult.status === "pending"
                            ? "text-violet-200"
                            : "text-red-300"
                      }`}
                    >
                      {cardRareResult.statusLabel}
                    </div>
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                    Reward
                  </div>
                  <div className="mt-2 w-fit rounded-full bg-violet-300/10 px-3 py-1 text-xs font-black text-violet-100">
                    {cardRareResult.conditionLabel ? "แบบเงื่อนไขพิเศษ" : "แบบมาตรฐาน"}
                  </div>
                  <div className="mt-2 text-sm font-bold text-white/75">
                    {cardRareResult.rewardLabel}
                  </div>
                  {cardRareResult.conditionLabel ? (
                    <div className="mt-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-black text-white/62">
                      {cardRareResult.conditionLabel}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                    Serial Code
                  </div>
                  <div className="mt-2 break-all text-sm font-black text-white/88">
                    {cardRareResult.code}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                      เธชเธฃเนเธฒเธเน€เธกเธทเนเธญ
                    </div>
                    <div className="mt-2 text-sm font-bold text-white/75">
                      {formatThaiDateTime(cardRareResult.createdAt)}
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                      เธซเธกเธ”เน€เธงเธฅเธฒ
                    </div>
                    <div className="mt-2 text-sm font-bold text-white/75">
                      {formatThaiDateTime(cardRareResult.expiresAt)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void confirmCardRareAction("approve")}
                    disabled={loading || cardRareResult.status !== "pending"}
                    className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[22px] bg-[linear-gradient(135deg,#f5d0fe,#a855f7,#6d28d9)] px-4 py-3 text-sm font-black text-white shadow-[0_0_24px_rgba(168,85,247,0.28)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    เธญเธเธธเธกเธฑเธ•เธด
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmCardRareAction("cancel")}
                    disabled={loading || cardRareResult.status !== "pending"}
                    className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[22px] border border-red-300/18 bg-red-500/10 px-4 py-3 text-sm font-black text-red-200 transition hover:bg-red-500/16 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <XCircle className="h-4 w-4" />
                    เธขเธเน€เธฅเธดเธ
                  </button>
                </div>
              </div>
            ) : result ? (
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
                        result.isReversed
                          ? "text-red-300"
                          : result.used
                            ? "text-white/70"
                            : "text-emerald-300"
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
                      {formatThaiDateTime(result.createdAt)}
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                      ใช้งานเมื่อ
                    </div>
                    <div className="mt-2 text-sm font-bold text-white/75">
                      {result.usedAt ? formatThaiDateTime(result.usedAt) : "-"}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void confirmCouponUse()}
                  disabled={loading || result.used || result.isReversed}
                  className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[22px] bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-4 py-3 text-sm font-black text-black shadow-[0_0_24px_rgba(250,204,21,0.26)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  {result.used
                    ? "คูปองถูกใช้งานแล้ว"
                    : result.isReversed
                      ? "คูปองถูกย้อนกลับแล้ว"
                    : "ยืนยันการใช้งานของจริง"}
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm leading-6 text-white/48">
                ยิงสแกนคูปองหรือกรอกรหัสเพื่อดึงข้อมูลขึ้นมาก่อน จากนั้นพนักงานกดยืนยันใช้งานจริงได้จากปุ่มเหลืองด้านล่าง
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
