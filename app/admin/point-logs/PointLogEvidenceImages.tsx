"use client";

import { useState } from "react";
import { X } from "lucide-react";

type EvidenceImage = {
  name?: string;
  type?: string;
  size?: number;
  dataUrl?: string;
};

function parseEvidenceImages(value?: string | null): EvidenceImage[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((image) => ({
        name: String(image?.name || "หลักฐาน"),
        type: String(image?.type || "image/*"),
        size: Number(image?.size || 0),
        dataUrl: String(image?.dataUrl || ""),
      }))
      .filter((image) => String(image.dataUrl || "").startsWith("data:image/"));
  } catch {
    return [];
  }
}

export default function PointLogEvidenceImages({ evidenceJson }: { evidenceJson?: string | null }) {
  const images = parseEvidenceImages(evidenceJson);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeImage = activeIndex === null ? null : images[activeIndex] || null;

  if (!images.length) return null;

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {images.map((image, index) => (
          <button
            key={`${image.name}-${index}`}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="group relative h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/35 outline-none transition hover:border-amber-300/45 focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300/25"
            title={image.name || "หลักฐาน"}
          >
            <img
              src={image.dataUrl}
              alt={image.name || "หลักฐาน"}
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {activeImage ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/82 p-4 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveIndex(null)}
        >
          <div
            className="relative max-h-[92dvh] w-full max-w-5xl overflow-hidden rounded-[26px] border border-white/12 bg-[#0d0d12] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                  Evidence
                </div>
                <div className="mt-1 truncate text-sm font-black text-white">
                  {activeImage.name || "หลักฐาน"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveIndex(null)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white transition hover:bg-white/[0.12]"
                aria-label="ปิดรูป"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex max-h-[calc(92dvh-76px)] items-center justify-center overflow-auto bg-black p-3">
              <img
                src={activeImage.dataUrl}
                alt={activeImage.name || "หลักฐาน"}
                className="max-h-[calc(92dvh-100px)] w-auto max-w-full rounded-2xl object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
