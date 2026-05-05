"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Boxes,
  Check,
  PackageOpen,
  Plus,
  RefreshCw,
  ShieldCheck,
  Tag,
} from "lucide-react";
import type {
  BoxMarketListing,
  BoxProductAsset,
  BoxProductType,
  DealerVerificationStatus,
} from "@/lib/box-market-types";

type FormState = {
  productId: string;
  price: string;
  quantity: string;
};

type SealedProductOption = {
  id: string;
  title: string;
  thaiName: string;
  productType: BoxProductType;
  description: string;
  assetName: string;
};

const SEALED_PRODUCT_OPTIONS: SealedProductOption[] = [
  {
    id: "bronze-pack",
    title: "NEXORA Bronze Pack",
    thaiName: "ซองบรอนซ์",
    productType: "pack",
    description: "ซองการ์ดแท้ NEXORA Bronze Pack (ซองบรอนซ์)",
    assetName: "Bronze-Pack.png",
  },
  {
    id: "silver-pack",
    title: "NEXORA Silver Pack",
    thaiName: "ซองซิลเวอร์",
    productType: "pack",
    description: "ซองการ์ดแท้ NEXORA Silver Pack (ซองซิลเวอร์)",
    assetName: "Silver-Pack.png",
  },
  {
    id: "gold-pack",
    title: "NEXORA Gold Pack",
    thaiName: "ซองโกลด์",
    productType: "pack",
    description: "ซองการ์ดแท้ NEXORA Gold Pack (ซองโกลด์)",
    assetName: "Gold-Pack.png",
  },
  {
    id: "bronze-box",
    title: "NEXORA Bronze Box",
    thaiName: "กล่องบรอนซ์",
    productType: "box",
    description: "กล่องการ์ดแท้ NEXORA Bronze Box (กล่องบรอนซ์)",
    assetName: "Bronze-Box.png",
  },
  {
    id: "silver-box",
    title: "NEXORA Silver Box",
    thaiName: "กล่องซิลเวอร์",
    productType: "box",
    description: "กล่องการ์ดแท้ NEXORA Silver Box (กล่องซิลเวอร์)",
    assetName: "Silver-Box.png",
  },
  {
    id: "gold-box",
    title: "NEXORA Gold Box",
    thaiName: "กล่องโกลด์",
    productType: "box",
    description: "กล่องการ์ดแท้ NEXORA Gold Box (กล่องโกลด์)",
    assetName: "Glod-Box.png",
  },
];

function buildInitialForm(): FormState {
  return {
    productId: SEALED_PRODUCT_OPTIONS[0].id,
    price: "",
    quantity: "1",
  };
}

function getProductAssetUrl(assets: BoxProductAsset[], assetName: string) {
  return (
    assets.find((asset) => asset.name === assetName)?.url ||
    `/box-products/${encodeURIComponent(assetName)}`
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatListingDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function productLabel(value: BoxProductType) {
  return value === "pack" ? "ซองการ์ด" : "กล่องการ์ด";
}

function ProductVisual({
  imageUrl,
  title,
  compact = false,
}: {
  imageUrl: string | null;
  title: string;
  compact?: boolean;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={title}
        loading="lazy"
        className={`h-full w-full object-contain ${compact ? "p-2 sm:p-3" : "p-3 sm:p-4"}`}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[linear-gradient(135deg,#0a0b0d_0%,#1d1f24_52%,#f6f6f6_53%,#d7d7d9_100%)] text-white">
      <PackageOpen className={compact ? "h-9 w-9" : "h-12 w-12"} />
      <span className="mt-3 text-[10px] font-black uppercase tracking-[0.24em] text-white/72">
        NEXORA SEALED
      </span>
    </div>
  );
}

export default function BoxMarketClient({
  initialListings,
  productAssets,
}: {
  initialListings: BoxMarketListing[];
  productAssets: BoxProductAsset[];
}) {
  const [listings, setListings] = useState(initialListings);
  const [assets] = useState(productAssets);
  const [form, setForm] = useState<FormState>(() => buildInitialForm());
  const [dealerStatus, setDealerStatus] =
    useState<DealerVerificationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const verifiedListings = useMemo(
    () => listings.filter((item) => item.isDealerVerified).length,
    [listings]
  );
  const selectedProduct = useMemo(() => {
    const option =
      SEALED_PRODUCT_OPTIONS.find((item) => item.id === form.productId) ||
      SEALED_PRODUCT_OPTIONS[0];

    return {
      ...option,
      imageUrl: getProductAssetUrl(assets, option.assetName),
    };
  }, [assets, form.productId]);

  useEffect(() => {
    let cancelled = false;

    async function loadDealerStatus() {
      try {
        const res = await fetch(`/api/box-market/verify?ts=${Date.now()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!cancelled) {
          setDealerStatus(data);
        }
      } catch {
        if (!cancelled) {
          setDealerStatus({ verified: false, status: "none", verifiedAt: null });
        }
      }
    }

    void loadDealerStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshListings(silent = true) {
      if (!silent) setRefreshing(true);
      try {
        const res = await fetch(`/api/box-market?ts=${Date.now()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.listings)) {
          setListings(data.listings);
        }
      } catch {
        return;
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    }

    const handleFocus = () => {
      void refreshListings(true);
    };
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshListings(true);
      }
    }, 10000);

    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  async function submitListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const price = Number(form.price);
    const parsedQuantity = Math.floor(Number(form.quantity || 1));
    const quantity =
      Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;

    setError("");
    setNotice("");

    if (!selectedProduct) {
      setError("เลือกสินค้าที่ต้องการลงขายก่อน");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      setError("กรอกราคาขายให้ถูกต้อง");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/box-market", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: selectedProduct.title,
          productType: selectedProduct.productType,
          description: selectedProduct.description,
          price,
          quantity,
          imageUrl: selectedProduct.imageUrl || null,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        setError(data?.error || "ลงขายไม่สำเร็จ");
        return;
      }

      setListings((current) => [
        data.listing,
        ...current.filter((item) => item.id !== data.listing.id),
      ]);
      setForm(buildInitialForm());
      setNotice("ลงขายสำเร็จ รายการใหม่ขึ้นบนสุดแล้ว");
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างลงขาย");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full text-black">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 pb-4">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="overflow-hidden rounded-[28px] bg-[#050506] text-white shadow-[0_24px_90px_rgba(0,0,0,0.34)] ring-1 ring-white/10">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="p-5 sm:p-7">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white/72">
                    <Boxes className="h-3.5 w-3.5" />
                    NEXORA SEALED MARKET
                  </span>
                  {dealerStatus?.verified && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-black text-emerald-200">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      ตัวแทนจำหน่ายยืนยันแล้ว
                    </span>
                  )}
                </div>

                <h1 className="mt-5 max-w-3xl text-[34px] font-black leading-[0.98] text-white sm:text-5xl lg:text-6xl">
                  ตลาดขายซอง/กล่องการ์ดแท้ NEXORA
                </h1>
                <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-white/62 sm:text-base">
                  ลงขายกล่องและซองการ์ดปิดผนึก ราคาอิสระ ใครลงล่าสุดขึ้นก่อน
                  และรายการจากตัวแทนจำหน่ายจริงจะมีเครื่องหมายยืนยันกำกับบนสินค้า
                </p>

                <div className="mt-6 grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3">
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.055] p-3">
                    <div className="text-2xl font-black">{listings.length}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
                      listed
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.055] p-3">
                    <div className="text-2xl font-black">{verifiedListings}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
                      verified
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.055] p-3">
                    <div className="text-2xl font-black">{assets.length}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
                      assets
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/8 bg-white/[0.035] p-5 lg:border-l lg:border-t-0">
                <div className="flex h-full flex-col justify-between gap-5 rounded-[24px] bg-white p-5 text-black">
                  <div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <h2 className="mt-4 text-2xl font-black leading-tight">
                      ยืนยันตัวแทนจำหน่าย
                    </h2>
                    <p className="mt-2 text-sm font-medium leading-6 text-black/54">
                      เมื่อข้อมูลตรงกับ Google Sheet รายการที่ลงขายหลังจากนั้นจะขึ้นตรายืนยันทันที
                    </p>
                  </div>
                  <Link
                    href="/box-market/verify"
                    className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-black px-4 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
                  >
                    <BadgeCheck className="h-4 w-4" />
                    ไปยืนยันตัวแทน
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <form
            onSubmit={submitListing}
            className="rounded-[28px] border border-black/8 bg-white p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-black/42">
                  Create Listing
                </div>
                <h2 className="mt-1 text-2xl font-black">ลงขายสินค้า</h2>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-white">
                <Plus className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[24px] border border-black/8 bg-[#f4f4f5]">
              <div className="aspect-[4/3]">
                <ProductVisual
                  imageUrl={selectedProduct.imageUrl}
                  title={selectedProduct.title}
                />
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="block text-xs font-black text-black/62">
                    เลือกสินค้า
                  </label>
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-black/34">
                    select one
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SEALED_PRODUCT_OPTIONS.map((item) => {
                    const active = form.productId === item.id;
                    const imageUrl = getProductAssetUrl(assets, item.assetName);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            productId: item.id,
                          }))
                        }
                        aria-pressed={active}
                        className={`rounded-[18px] border p-2 text-left transition ${
                          active
                            ? "border-black bg-black text-white shadow-[0_14px_36px_rgba(0,0,0,0.22)]"
                            : "border-black/10 bg-white text-black hover:border-black/24"
                        }`}
                      >
                        <span className="relative block aspect-[4/3] overflow-hidden rounded-[14px] bg-[#f5f5f6]">
                          <ProductVisual imageUrl={imageUrl} title={item.title} compact />
                          {active && (
                            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black text-white shadow-[0_8px_18px_rgba(0,0,0,0.22)] ring-2 ring-white">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </span>
                        <span className="mt-2 block text-[12px] font-black leading-tight">
                          {item.title}
                        </span>
                        <span
                          className={`mt-1 block text-[11px] font-bold leading-tight ${
                            active ? "text-white/62" : "text-black/48"
                          }`}
                        >
                          ({item.thaiName})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-xs font-black text-black/62">
                    ราคา
                  </label>
                  <input
                    value={form.price}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, price: event.target.value }))
                    }
                    inputMode="decimal"
                    placeholder="0"
                    className="w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-black/35"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black text-black/62">
                    จำนวน
                  </label>
                  <input
                    value={form.quantity}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        quantity: event.target.value,
                      }))
                    }
                    inputMode="numeric"
                    placeholder="1"
                    className="w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-black/35"
                  />
                </div>
              </div>
            </div>

            {(notice || error) && (
              <div
                className={`mt-4 rounded-[18px] px-4 py-3 text-sm font-bold ${
                  error
                    ? "bg-red-500/10 text-red-700"
                    : "bg-emerald-500/10 text-emerald-700"
                }`}
              >
                {error || notice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-[20px] bg-black px-4 py-4 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {loading ? "กำลังลงขาย..." : "ลงขายกล่องหรือซองนี้"}
            </button>
          </form>
        </section>

        <section className="rounded-[28px] border border-black/8 bg-white p-4 shadow-[0_18px_70px_rgba(0,0,0,0.14)] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-black/42">
                Latest Listings
              </div>
              <h2 className="mt-1 text-2xl font-black">รายการล่าสุด</h2>
            </div>
            <button
              type="button"
              onClick={async () => {
                setRefreshing(true);
                try {
                  const res = await fetch(`/api/box-market?ts=${Date.now()}`, {
                    cache: "no-store",
                  });
                  const data = await res.json();
                  if (Array.isArray(data?.listings)) {
                    setListings(data.listings);
                  }
                } finally {
                  setRefreshing(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-[16px] border border-black/10 px-3 py-2 text-xs font-black text-black transition hover:border-black/24"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              รีเฟรช
            </button>
          </div>

          {listings.length === 0 ? (
            <div className="mt-5 flex min-h-[260px] flex-col items-center justify-center rounded-[24px] border border-dashed border-black/12 bg-black/[0.025] px-4 text-center">
              <PackageOpen className="h-10 w-10 text-black/32" />
              <div className="mt-4 text-lg font-black">ยังไม่มีรายการขาย</div>
              <div className="mt-2 max-w-sm text-sm font-medium leading-6 text-black/45">
                รายการแรกที่ถูกลงขายจะขึ้นด้านบนทันที
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {listings.map((listing) => (
                <article
                  key={listing.id}
                  className="group overflow-hidden rounded-[24px] border border-black/8 bg-white shadow-[0_16px_45px_rgba(0,0,0,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(0,0,0,0.16)]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#f3f3f4]">
                    <ProductVisual
                      imageUrl={listing.imageUrl}
                      title={listing.title}
                      compact
                    />
                    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full bg-black px-3 py-1 text-[11px] font-black text-white">
                        {productLabel(listing.productType)}
                      </span>
                      {listing.isDealerVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-black shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          ตัวแทนจริง
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="line-clamp-2 text-lg font-black leading-tight">
                          {listing.title}
                        </h3>
                        <div className="mt-2 truncate text-xs font-bold text-black/42">
                          {formatListingDate(listing.createdAt)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 rounded-full bg-black/[0.04] px-2.5 py-1 text-xs font-black text-black/62">
                        <Tag className="h-3.5 w-3.5" />
                        x{listing.quantity}
                      </div>
                    </div>

                    {listing.description && (
                      <p className="mt-3 line-clamp-2 min-h-[40px] text-sm font-medium leading-5 text-black/48">
                        {listing.description}
                      </p>
                    )}

                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-black/8 pt-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-black/36">
                          price
                        </div>
                        <div className="mt-1 text-xl font-black">
                          {formatPrice(listing.price)} บาท
                        </div>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <img
                          src={listing.sellerImage || "/avatar.png"}
                          alt={listing.sellerName}
                          loading="lazy"
                          className="h-9 w-9 shrink-0 rounded-[14px] object-cover"
                        />
                        <div className="min-w-0 text-right">
                          <div className="max-w-[100px] truncate text-xs font-black">
                            {listing.sellerName}
                          </div>
                          <div className="mt-0.5 text-[10px] font-bold text-black/38">
                            seller
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
