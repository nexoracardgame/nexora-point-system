"use client";

import { useEffect, useState } from "react";
import { formatThaiDate } from "@/lib/thai-time";

type SoldItem = {
  id: string;
  cardName: string;
  imageUrl: string;
  price: number;
  createdAt: string;
};

export default function SoldHistory({ userId }: { userId: string }) {
  const [items, setItems] = useState<SoldItem[]>([]);

  useEffect(() => {
    fetch(`/api/market/sold-history/${userId}`)
      .then((res) => res.json())
      .then(setItems);
  }, [userId]);

  if (items.length === 0) {
    return (
      <div className="text-zinc-400 text-sm mt-4">
        ยังไม่มีประวัติการขาย
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="text-xl font-bold mb-4 text-yellow-400">
        📦 Sold Cards
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-zinc-900 rounded-2xl p-3 shadow-lg hover:scale-[1.03] transition"
          >
            <img
              src={item.imageUrl}
              className="rounded-xl aspect-[2/3] object-cover"
            />

            <div className="mt-2 text-sm font-bold truncate">
              {item.cardName}
            </div>

            <div className="text-yellow-400 font-bold">
              ฿{item.price?.toLocaleString()}
            </div>

            <div className="text-xs text-zinc-400">{formatThaiDate(item.createdAt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
