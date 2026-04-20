"use client";

import { useEffect, useRef, useState } from "react";

export default function CardStatsClient({
  cardNo,
  listingId,
  initialViews,
  initialLikes,
}: {
  cardNo: string;
  listingId: string;
  initialViews: number;
  initialLikes: number;
}) {
  const [views, setViews] = useState(initialViews);
  const hasTrackedView = useRef(false);
  const [liked] = useState(() => {
    if (typeof window === "undefined") return false;

    try {
      const raw = localStorage.getItem("nexora_market_likes");
      const parsed = raw ? JSON.parse(raw) : {};

      return (
        !!parsed[listingId] ||
        (Array.isArray(parsed) && parsed.includes(listingId)) ||
        !!parsed[cardNo]
      );
    } catch {
      return false;
    }
  });
  const likes = initialLikes + (liked ? 1 : 0);

  useEffect(() => {
    if (hasTrackedView.current) return;
    hasTrackedView.current = true;

    fetch(`/api/market/listings/${listingId}/view`, {
      method: "POST",
    })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.views === "number") {
          setViews(data.views);
        }
      })
      .catch(() => {});
  }, [listingId]);

  return (
    <>
      <StatCard label="Likes" value={String(likes)} />
      <StatCard label="Views" value={String(views)} />
    </>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/6 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </div>
      <div className="mt-3 text-lg font-black">{value}</div>
    </div>
  );
}
