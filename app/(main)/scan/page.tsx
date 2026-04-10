"use client";

import { useEffect, useRef, useState } from "react";

type CardData = {
  cardNo: string;
  cardName: string;
  rarity: string;
  reward?: string;
};

export default function ScanPage() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState("");
  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState("📸 แตะปุ่มเพื่อสแกนการ์ด");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // 🚀 warm AI cloud
    fetch("/api/scan-ai", {
      method: "POST",
      body: JSON.stringify({ image: "warmup" }),
      headers: {
        "Content-Type": "application/json",
      },
    }).catch(() => {});
  }, []);

  const handleCapture = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setCard(null);
    setStatus("🧠 AI SERVER กำลังวิเคราะห์...");

    try {
      const img = document.createElement("img");
      const previewUrl = URL.createObjectURL(file);

      // 🚀 preview ทันที
      setPreview(previewUrl);

      img.onload = async () => {
        try {
          const canvas = document.createElement("canvas");

          const maxWidth = 900;
          const scale = Math.min(1, maxWidth / img.width);

          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            setStatus("❌ canvas error");
            return;
          }

          ctx.drawImage(
            img,
            0,
            0,
            canvas.width,
            canvas.height
          );

          const image = canvas.toDataURL(
            "image/jpeg",
            0.82
          );

          const aiRes = await fetch("/api/scan-ai", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ image }),
          });

          const raw = await aiRes.text();

          if (!aiRes.ok) {
            throw new Error(raw || "AI server failed");
          }

          const ai = JSON.parse(raw);

          if (!ai.cardNo) {
            setStatus("❌ AI อ่านไม่ออก");
            return;
          }

          setCard({
            cardNo: ai.cardNo,
            cardName:
              ai.card_name ||
              ai.cardName ||
              "Unknown Card",
            rarity: ai.rarity || "-",
            reward: ai.reward,
          });

          setStatus(
            `🃏 ${ai.cardNo} (${Math.round(
              (ai.confidence || 0) * 100
            )}%)`
          );
        } catch (error) {
          console.error(error);
          setStatus("❌ AI วิเคราะห์ไม่สำเร็จ");
        } finally {
          setIsProcessing(false);
          URL.revokeObjectURL(previewUrl);
        }
      };

      img.src = previewUrl;
    } catch (err) {
      console.error(err);
      setStatus("❌ scan fail");
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black px-4 py-6 text-white">
      <div className="mx-auto max-w-md">
        <div className="mb-4 rounded-2xl border border-yellow-500/20 bg-white/5 p-4">
          {status}
        </div>

        {preview && (
          <div className="mb-4 overflow-hidden rounded-3xl border border-yellow-500/20">
            <img
              src={preview}
              alt="preview"
              className="aspect-[4/5] w-full object-cover"
            />
          </div>
        )}

        <button
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing}
          className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-yellow-200 bg-yellow-400 text-4xl text-black shadow-[0_20px_100px_rgba(234,179,8,0.55)]"
        >
          {isProcessing ? "⏳" : "📸"}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            handleCapture(e);
            e.currentTarget.value = "";
          }}
          className="hidden"
        />

        {card && (
          <div className="mt-6 rounded-3xl border border-yellow-500/20 bg-white/5 p-5">
            <div className="text-yellow-300">
              CARD #{card.cardNo}
            </div>
            <div className="text-2xl font-black">
              {card.cardName}
            </div>
            <div className="mt-2 text-sm text-zinc-400">
              ✨ {card.rarity}
            </div>
            {card.reward && (
              <div className="mt-4 rounded-2xl bg-yellow-500/10 p-3 text-sm">
                🎁 {card.reward}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}