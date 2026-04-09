"use client";

import { useState } from "react";

type CardData = {
  cardNo: string;
  cardName: string;
  rarity: string;
  setName?: string;
  reward?: string;
};

export default function ScanPage() {
  const [preview, setPreview] = useState("");
  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState("📸 แตะปุ่มเพื่อถ่ายการ์ด");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCapture = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setCard(null);
    setStatus("🧠 AI SERVER กำลังวิเคราะห์...");

    try {
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const image = reader.result as string;
          setPreview(image);

          const aiRes = await fetch("/api/scan-ai", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ image }),
          });

          if (!aiRes.ok) {
            throw new Error("AI server failed");
          }

          const ai = await aiRes.json();

          if (!ai.cardNo) {
            setStatus("❌ AI อ่านไม่ออก");
            return;
          }

          const cardRes = await fetch(`/api/card?cardNo=${ai.cardNo}`);
          const data = await cardRes.json();

          setCard({
            cardNo: ai.cardNo,
            cardName: data.card_name || "Unknown Card",
            rarity: data.rarity || "-",
            setName: data.set_name,
            reward: data.reward,
          });

          setStatus(
            `🃏 ${ai.cardNo} (${Math.round(
              (ai.confidence || 0) * 100
            )}%)`
          );
        } catch (error: any) {
          console.error(error);
          setStatus("❌ AI วิเคราะห์ไม่สำเร็จ");
        } finally {
          setIsProcessing(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ ${err?.message || "scan fail"}`);
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

        <label className="relative flex h-24 w-24 cursor-pointer items-center justify-center rounded-full border-4 border-yellow-200 bg-yellow-400 text-4xl text-black shadow-[0_20px_100px_rgba(234,179,8,0.55)]">
          {isProcessing ? "⏳" : "📸"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple={false}
            onChange={(e) => {
              handleCapture(e);
              e.currentTarget.value = "";
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>

        {card && (
          <div className="mt-6 rounded-3xl border border-yellow-500/20 bg-white/5 p-5">
            <div className="text-yellow-300">CARD #{card.cardNo}</div>
            <div className="text-2xl font-black">{card.cardName}</div>
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