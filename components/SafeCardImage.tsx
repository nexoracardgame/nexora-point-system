"use client";

import { useEffect, useMemo, useState } from "react";
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

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [candidates]);

  return (
    <img
      src={candidates[index] || "/cards/001.jpg"}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding={decoding}
      className={className}
      onError={() => {
        setIndex((prev) => (prev < candidates.length - 1 ? prev + 1 : prev));
      }}
    />
  );
}
