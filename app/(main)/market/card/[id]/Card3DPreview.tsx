"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildLocalCardImageCandidates,
  sanitizeCardImageUrl,
} from "@/lib/card-image";

type Props = {
  image: string;
  name: string;
  cardNo?: string;
  remoteImageUrl?: string;
};

export default function Card3DPreview({
  image,
  name,
  cardNo,
  remoteImageUrl,
}: Props) {
  const candidates = useMemo(() => {
    const list = [
      ...buildLocalCardImageCandidates(cardNo),
      sanitizeCardImageUrl(image),
      sanitizeCardImageUrl(remoteImageUrl),
    ].filter(Boolean) as string[];

    return Array.from(new Set(list));
  }, [cardNo, image, remoteImageUrl]);

  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    setImgIndex(0);
  }, [candidates]);

  const currentImage = candidates[imgIndex] || image || remoteImageUrl || "";

  return (
    <div
      className="group relative mx-auto w-full max-w-[460px] [perspective:1600px]"
      onMouseMove={(e) => {
        const target = e.currentTarget;
        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const rotateY = ((x / rect.width) - 0.5) * 18;
        const rotateX = -((y / rect.height) - 0.5) * 18;

        const card = target.querySelector(".card-tilt") as HTMLElement;
        if (card) {
          card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        }
      }}
      onMouseLeave={(e) => {
        const card = e.currentTarget.querySelector(".card-tilt") as HTMLElement;
        if (card) {
          card.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)";
        }
      }}
    >
      <div className="absolute inset-0 rounded-[44px] bg-gradient-to-br from-yellow-300/10 via-orange-400/5 to-amber-500/10 blur-2xl scale-[1.08]" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[44px]">
        <div className="absolute left-10 top-10 h-2 w-2 animate-pulse rounded-full bg-yellow-300/70" />
        <div className="absolute right-12 top-24 h-1.5 w-1.5 animate-ping rounded-full bg-orange-300/60" />
        <div className="absolute bottom-20 left-16 h-2 w-2 animate-pulse rounded-full bg-amber-200/60" />
      </div>

      <div className="card-tilt relative rounded-[44px] bg-gradient-to-br from-[#ffe082] via-[#ffca28] to-[#ff9800] p-[2px] transition duration-200 ease-out shadow-[0_0_65px_rgba(255,180,0,0.22)]">
        <div className="rounded-[41px] bg-[#07090c] p-3">
          <div className="relative aspect-[2.5/3.5] overflow-hidden rounded-[32px] border border-yellow-300/20">
            {currentImage ? (
              <img
                src={currentImage}
                alt={name}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover"
                onError={() => {
                  if (imgIndex < candidates.length - 1) {
                    setImgIndex((v) => v + 1);
                  }
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-black/30 text-sm text-zinc-400">
                No Image
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-br from-cyan-300/10 via-pink-300/10 to-yellow-300/10 mix-blend-screen opacity-80" />
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/15 to-transparent animate-pulse" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/55 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
