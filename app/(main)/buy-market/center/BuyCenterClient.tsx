"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import BuyMarketFeatureNav from "@/components/BuyMarketFeatureNav";
import SafeCardImage from "@/components/SafeCardImage";
import type { BuyMarketListing } from "@/lib/buy-market-types";

type Dialog =
  | { type: "edit"; listing: BuyMarketListing }
  | { type: "delete"; listing: BuyMarketListing }
  | null;

function formatPrice(value?: number | null) {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

export default function BuyCenterClient({
  initialListings,
  currentUserId,
}: {
  initialListings: BuyMarketListing[];
  currentUserId: string;
}) {
  const [listings, setListings] = useState(initialListings);
  const [bootstrapped, setBootstrapped] = useState(initialListings.length > 0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshListings = useCallback(async (silent = true) => {
    if (!silent) setLoading(true);

    try {
      const res = await fetch(
        `/api/buy-market/listings?scope=manage&ts=${Date.now()}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));

      if (res.ok && Array.isArray(data?.listings)) {
        setListings(data.listings);
      }
    } finally {
      setBootstrapped(true);
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshListings(true);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshListings(true);
    }, 4000);
    const onFocus = () => void refreshListings(true);

    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshListings]);

  function openEdit(listing: BuyMarketListing) {
    setDialog({ type: "edit", listing });
    setPrice(String(listing.offerPrice || ""));
    setError("");
  }

  function openDelete(listing: BuyMarketListing) {
    setDialog({ type: "delete", listing });
    setError("");
  }

  async function confirmEdit() {
    if (!dialog || dialog.type !== "edit") return;
    const offerPrice = Number(price);
    if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
      setError("กรอกราคารับซื้อใหม่ให้ถูกต้อง");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/buy-market/listings/${dialog.listing.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ offerPrice }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data?.listing) {
        setError(data?.error || "แก้ไขราคาไม่สำเร็จ");
        return;
      }
      setListings((current) =>
        current.map((item) => (item.id === data.listing.id ? data.listing : item))
      );
      setDialog(null);
    } catch {
      setError("แก้ไขราคาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!dialog || dialog.type !== "delete") return;

    try {
      setLoading(true);
      const res = await fetch(`/api/buy-market/listings/${dialog.listing.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || "ลบโพสต์รับซื้อไม่สำเร็จ");
        return;
      }
      setListings((current) => current.filter((item) => item.id !== dialog.listing.id));
      setDialog(null);
    } catch {
      setError("ลบโพสต์รับซื้อไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 text-black">
      <section className="rounded-[28px] bg-white p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)] ring-1 ring-black/5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-black/42">
              Buy Post Center
            </div>
            <h1 className="mt-1 text-3xl font-black sm:text-5xl">
              จัดการโพสต์รับซื้อ
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-black/52">
              แก้ไขราคารับซื้อหรือลบโพสต์รับซื้อของคุณได้จากหน้านี้
            </p>
          </div>
        </div>
      </section>

      <BuyMarketFeatureNav />

      {!bootstrapped ? (
        <div className="flex items-center justify-center rounded-[28px] bg-white p-8 text-sm font-black text-black/45 shadow-[0_20px_60px_rgba(0,0,0,0.14)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          กำลังโหลดโพสต์รับซื้อ...
        </div>
      ) : listings.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-black/10 bg-white p-8 text-center text-sm font-bold text-black/45">
          คุณยังไม่มีโพสต์รับซื้อ
        </div>
      ) : (
        <div className="grid gap-3">
          {listings.map((listing) => {
            const canEdit = listing.buyerId === currentUserId;
            const canDelete = canEdit;

            return (
              <article
                key={listing.id}
                className="flex flex-col gap-3 rounded-[24px] bg-white p-3 shadow-[0_18px_54px_rgba(0,0,0,0.14)] ring-1 ring-black/5 sm:flex-row sm:items-center"
              >
                <Link
                  href={`/buy-market/card/${listing.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <SafeCardImage
                    cardNo={listing.cardNo}
                    imageUrl={listing.imageUrl || undefined}
                    alt={listing.cardName || `Card #${listing.cardNo}`}
                    className="h-20 w-14 shrink-0 rounded-[16px] object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-lg font-black">
                      {listing.cardName || `Card #${listing.cardNo}`}
                    </div>
                    <div className="mt-1 text-sm font-bold text-black/45">
                      รับซื้อ {formatPrice(listing.offerPrice)} · Card #{listing.cardNo}
                    </div>
                  </div>
                </Link>

                <Link
                  href={`/profile/${listing.buyerId}`}
                  className="flex min-w-0 items-center gap-2 rounded-[18px] bg-[#f4f4f5] px-3 py-2"
                >
                  <img
                    src={listing.buyerImage || "/avatar.png"}
                    alt={listing.buyerName}
                    className="h-9 w-9 shrink-0 rounded-2xl object-cover"
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-black/35">
                      Buyer
                    </div>
                    <div className="truncate text-xs font-black text-black/70">
                      {listing.buyerName}
                    </div>
                  </div>
                </Link>

                <div className="flex flex-wrap gap-2">
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => openEdit(listing)}
                      className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-black text-white"
                    >
                      <Pencil className="h-4 w-4" />
                      แก้ราคา
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => openDelete(listing)}
                      className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-xs font-black text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      ลบ
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {dialog ? (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-5 text-black shadow-[0_34px_120px_rgba(0,0,0,0.42)]">
            <h2 className="text-2xl font-black">
              {dialog.type === "edit" ? "แก้ไขราคารับซื้อ" : "ลบโพสต์รับซื้อ"}
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-black/52">
              {dialog.listing.cardName || `Card #${dialog.listing.cardNo}`}
            </p>

            {dialog.type === "edit" ? (
              <input
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                inputMode="decimal"
                className="mt-4 w-full rounded-[18px] border border-black/10 px-4 py-3 text-sm font-bold outline-none focus:border-black/35"
              />
            ) : (
              <div className="mt-4 rounded-[18px] bg-red-50 p-4 text-sm font-bold text-red-700">
                ยืนยันการลบโพสต์รับซื้อนี้ รายการจะไม่แสดงในตลาดรับซื้อแล้ว
              </div>
            )}

            {error ? (
              <div className="mt-3 rounded-[16px] bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                {error}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialog(null)}
                disabled={loading}
                className="rounded-full bg-[#f4f4f5] px-4 py-2 text-xs font-black text-black"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() =>
                  dialog.type === "edit" ? void confirmEdit() : void confirmDelete()
                }
                disabled={loading}
                className="rounded-full bg-black px-4 py-2 text-xs font-black text-white disabled:opacity-60"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
