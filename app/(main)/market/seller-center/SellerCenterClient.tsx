"use client";

import Link from "next/link";
import { Coins, Pencil } from "lucide-react";
import { useState } from "react";
import DeleteListingButton from "@/components/DeleteListingButton";
import SafeCardImage from "@/components/SafeCardImage";

type SellerListing = {
  id: string;
  imageUrl: string | null;
  cardNo: string;
  cardName: string | null;
  serialNo: string | null;
  price: number;
};

export default function SellerCenterClient({
  initialListings,
}: {
  initialListings: SellerListing[];
}) {
  const [listings, setListings] = useState(initialListings);

  if (listings.length === 0) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/50 backdrop-blur-xl sm:rounded-[32px] sm:p-10">
        ยังไม่มีโพสต์ขาย
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-8 xl:grid-cols-4">
      {listings.map((item) => (
        <div key={item.id} className="group relative">
          <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.05] backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:border-violet-400/30 hover:shadow-[0_0_80px_rgba(139,92,246,0.18)] sm:rounded-[32px] sm:hover:-translate-y-2">
            <Link
              href={`/market/card/${item.id}`}
              className="relative block aspect-[3/4] overflow-hidden"
            >
              <SafeCardImage
                cardNo={item.cardNo}
                imageUrl={item.imageUrl}
                alt={`Card ${item.cardNo}`}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

              <div className="absolute left-2 top-2 rounded-full border border-white/20 bg-black/50 px-2 py-1 text-[9px] font-semibold backdrop-blur-md sm:left-4 sm:top-4 sm:px-3 sm:text-xs">
                #{item.cardNo}
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-5">
                <div className="line-clamp-2 text-sm font-black leading-tight sm:text-2xl">
                  {item.cardName || `Card #${String(item.cardNo).padStart(3, "0")}`}
                </div>

                <div className="mt-1 text-[10px] text-white/60 sm:text-xs">
                  Serial: {item.serialNo || "-"}
                </div>

                <div className="mt-2 flex items-center gap-1 text-sm font-black text-amber-300 sm:mt-3 sm:gap-2 sm:text-lg">
                  <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  ฿{Number(item.price || 0).toLocaleString("th-TH")}
                </div>
              </div>
            </Link>

            <div className="grid grid-cols-2 gap-2 p-2 sm:gap-3 sm:p-4">
              <Link
                href={`/market/edit/${item.id}`}
                className="flex items-center justify-center gap-1 rounded-2xl border border-blue-400/20 bg-blue-500/15 px-3 py-3 text-[11px] font-bold text-blue-300 transition hover:bg-blue-500/25 sm:gap-2 sm:px-4 sm:text-sm"
              >
                <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                แก้ราคา
              </Link>

              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-1 py-1 transition hover:bg-red-500/20 sm:px-2 sm:py-2">
                <DeleteListingButton
                  id={item.id}
                  onDeleted={() => {
                    setListings((prev) => prev.filter((listing) => listing.id !== item.id));
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
