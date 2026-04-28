"use client";

import { useMemo, useState } from "react";
import {
  buildLocalCardImage,
  buildLocalCardImageCandidates,
  sanitizeCardImageUrl,
} from "@/lib/card-image";

type Props = {
  cardNo?: string | number | null;
  imageUrl?: string | null;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  decoding?: "sync" | "async" | "auto";
};

export default function SafeCardImage({
  cardNo,
  imageUrl,
  alt,
  className,
  loading = "lazy",
  fetchPriority = "auto",
  decoding = "async",
}: Props) {
  const candidates = useMemo(() => {
    const localCandidates = buildLocalCardImageCandidates(cardNo);
    const remote = sanitizeCardImageUrl(imageUrl);
    const fallback = buildLocalCardImage(cardNo || "001");

    return Array.from(
      new Set([...localCandidates, remote, fallback, "/cards/001.jpg"].filter(Boolean))
    ) as string[];
  }, [cardNo, imageUrl]);

  const candidateKey = candidates.join("|");
  const [state, setState] = useState<{ key: string; index: number }>({
    key: candidateKey,
    index: 0,
  });
  const index = state.key === candidateKey ? state.index : 0;

  return (
    <img
      src={candidates[index] || "/cards/001.jpg"}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding={decoding}
      className={className}
      onError={() => {
        setState((prev) => {
          const baseIndex = prev.key === candidateKey ? prev.index : 0;
          return {
            key: candidateKey,
            index: baseIndex < candidates.length - 1 ? baseIndex + 1 : baseIndex,
          };
        });
      }}
    />
  );
}
