"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Coins, Eye, Pencil, RotateCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import DeleteListingButton from "@/components/DeleteListingButton";
import SafeCardImage from "@/components/SafeCardImage";
import {
  readClientViewCache,
  writeClientViewCache,
} from "@/lib/client-view-cache";

type SellerListing = {
  id: string;
  imageUrl: string | null;
  cardNo: string;
  cardName: string | null;
  serialNo: string | null;
  price: number;
};

function normalizeListing(item: Partial<SellerListing>): SellerListing {
  return {
    id: String(item.id || ""),
    imageUrl: item.imageUrl || null,
    cardNo: String(item.cardNo || ""),
    cardName: item.cardName || null,
    serialNo: item.serialNo || null,
    price: Number(item.price || 0),
  };
}

function ListingSkeleton() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-black/8 bg-white p-3 shadow-[0_22px_70px_rgba(10,10,14,0.12)] ring-1 ring-white/70">
      <div className="aspect-[3/4] animate-pulse rounded-[22px] bg-[#ece8e3]" />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="h-10 animate-pulse rounded-2xl bg-[#ece8e3]" />
        <div className="h-10 animate-pulse rounded-2xl bg-[#ece8e3]" />
        <div className="h-10 animate-pulse rounded-2xl bg-[#ece8e3]" />
      </div>
    </div>
  );
}

export default function SellerCenterClient({
  initialListings,
}: {
  initialListings: SellerListing[];
}) {
  const { status } = useSession();
  const cachedListings = useMemo(
    () =>
      readClientViewCache<SellerListing[]>("seller-center-listings", {
        maxAgeMs: 180000,
      }),
    []
  );
  const [listings, setListings] = useState<SellerListing[]>(
    initialListings.length > 0
      ? initialListings
      : (cachedListings?.data || []).map(normalizeListing).filter((item) => item.id)
  );
  const [loading, setLoading] = useState(
    initialListings.length === 0 && !cachedListings?.data?.length
  );
  const [syncing, setSyncing] = useState(false);

  const syncListings = useCallback(async () => {
    try {
      setSyncing(true);

      const res = await fetch("/api/market/my-listings", {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return;
      }

      const nextListings = Array.isArray(data?.items)
        ? data.items.map(normalizeListing).filter((item: SellerListing) => item.id)
        : [];

      setListings(nextListings);
      writeClientViewCache("seller-center-listings", nextListings);
    } catch (error) {
      console.error("SELLER CENTER LISTINGS ERROR:", error);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      setLoading(false);
      return;
    }

    if (status === "loading") {
      return;
    }

    if (initialListings.length > 0) {
      writeClientViewCache("seller-center-listings", initialListings);
    }

    void syncListings();
  }, [initialListings, status, syncListings]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const onFocus = () => void syncListings();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void syncListings();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, syncListings]);

  if (status === "unauthenticated") {
    return (
      <div className="rounded-[30px] border border-black/8 bg-white p-8 text-center text-sm font-black text-black/55 shadow-[0_22px_70px_rgba(10,10,14,0.12)] ring-1 ring-white/70 sm:rounded-[40px] sm:p-12">
        กรุณาเข้าสู่ระบบก่อนจัดการโพสต์ขาย
      </div>
    );
  }

  if (loading && listings.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <ListingSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="rounded-[30px] border border-black/8 bg-white p-8 text-center text-sm font-black text-black/45 shadow-[0_22px_70px_rgba(10,10,14,0.12)] ring-1 ring-white/70 sm:rounded-[40px] sm:p-12">
        ยังไม่มีโพสต์ขาย
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-[11px] font-black text-white/54">
          <RotateCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "กำลังซิงก์" : "ซิงก์ล่าสุด"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
        {listings.map((item) => (
          <div key={item.id} className="group relative">
            <div className="overflow-hidden rounded-[28px] border border-black/8 bg-white p-2 text-black shadow-[0_22px_70px_rgba(10,10,14,0.12)] ring-1 ring-white/70 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_90px_rgba(10,10,14,0.18)] sm:rounded-[34px] sm:p-3">
              <Link
                href={`/market/card/${item.id}`}
                className="relative block aspect-[3/4] overflow-hidden rounded-[24px] bg-black"
              >
                <SafeCardImage
                  cardNo={item.cardNo}
                  imageUrl={item.imageUrl}
                  alt={`Card ${item.cardNo}`}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/12 to-transparent" />

                <div className="absolute left-2 top-2 rounded-full border border-white/18 bg-black/62 px-2 py-1 text-[9px] font-black text-white backdrop-blur-md sm:left-4 sm:top-4 sm:px-3 sm:text-xs">
                  #{item.cardNo}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-3 text-white sm:p-5">
                  <div className="line-clamp-2 text-sm font-black leading-tight sm:text-2xl">
                    {item.cardName ||
                      `Card #${String(item.cardNo).padStart(3, "0")}`}
                  </div>

                  <div className="mt-1 text-[10px] font-semibold text-white/60 sm:text-xs">
                    Serial: {item.serialNo || "-"}
                  </div>

                  <div className="mt-2 flex items-center gap-1 text-sm font-black text-amber-300 sm:mt-3 sm:gap-2 sm:text-lg">
                    <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    ฿{Number(item.price || 0).toLocaleString("th-TH")}
                  </div>
                </div>
              </Link>

              <div className="grid grid-cols-3 gap-2 p-2 sm:gap-2.5 sm:p-3">
                <Link
                  href={`/market/edit/${item.id}`}
                  className="flex min-h-[38px] items-center justify-center gap-1 rounded-2xl bg-black px-2 text-[10px] font-black text-white transition hover:-translate-y-0.5 hover:bg-zinc-900 sm:min-h-[42px] sm:text-xs"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  แก้ราคา
                </Link>

                <Link
                  href={`/market/card/${item.id}`}
                  className="flex min-h-[38px] items-center justify-center gap-1 rounded-2xl border border-black/8 bg-[#f3eee9] px-2 text-[10px] font-black text-black transition hover:-translate-y-0.5 hover:bg-[#ebe5de] sm:min-h-[42px] sm:text-xs"
                >
                  <Eye className="h-3.5 w-3.5" />
                  ดูการ์ด
                </Link>

                <DeleteListingButton
                  id={item.id}
                  size="compact"
                  label="ลบ"
                  title="ยืนยันการลบการ์ด"
                  description="การ์ดใบนี้จะถูกลบออกจากตลาดของคุณทันที"
                  onDeleted={() => {
                    setListings((prev) => {
                      const next = prev.filter((listing) => listing.id !== item.id);
                      writeClientViewCache("seller-center-listings", next);
                      return next;
                    });
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
