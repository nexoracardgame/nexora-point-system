"use client";

import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Gem,
  Layers3,
  Loader2,
  QrCode,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";

type CardSetRedemptionType =
  | "standard"
  | "foil_bonus"
  | "foil_sequence_1"
  | "foil_sequence_9"
  | "foil_sequence_18";

type CardSetItem = {
  id: string;
  order: number;
  name: string;
  subtitle: string;
  story: string;
  reward: string;
  tier: string;
  stars: string;
  totalCards: number;
  coverImage: string;
  fallbackImage: string;
  priorityImage: boolean;
  nexValue: number;
  bonusOptions: {
    type: Exclude<CardSetRedemptionType, "standard">;
    label: string;
    requiredFoilCount: number;
    nexValue: number;
  }[];
  finish: string;
};

type RedemptionItem = {
  setId: string;
  setOrder: number;
  setName: string;
  rewardLabel: string;
  redemptionType: CardSetRedemptionType;
  conditionLabel: string | null;
  nexValue: number;
  quantity: number;
  lineTotalNex: number;
};

type Redemption = {
  id: string;
  code: string;
  setId: string;
  setOrder: number;
  setName: string;
  rewardLabel: string;
  redemptionType: CardSetRedemptionType;
  conditionLabel: string | null;
  nexValue: number;
  items: RedemptionItem[];
  itemCount: number;
  totalQuantity: number;
  createdByAdminMode?: boolean;
  status: "pending" | "approved" | "cancelled" | "expired";
  createdAt: string;
  expiresAt: string;
  statusLabel: string;
  valueLabel: string;
};

type SelectedSet = {
  setId: string;
  redemptionType: CardSetRedemptionType;
  quantity: string;
};

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("th-TH");
}

function parseSelectedQuantity(value: string | number | undefined) {
  const quantity = Math.floor(Number(value));
  return Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
}

function normalizeQuantityInput(value: string) {
  return value.replace(/\D/g, "");
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function selectionKey(
  setId: string,
  redemptionType: CardSetRedemptionType = "standard"
) {
  return `${setId}::${redemptionType}`;
}

function formatRemaining(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function CardSetClient({
  sets,
  canUseAdminMode = false,
}: {
  sets: CardSetItem[];
  canUseAdminMode?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [multiMode, setMultiMode] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [selected, setSelected] = useState<Record<string, SelectedSet>>({});
  const [confirmSet, setConfirmSet] = useState<CardSetItem | null>(null);
  const [active, setActive] = useState<Redemption | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRedemptionType, setSelectedRedemptionType] =
    useState<CardSetRedemptionType>("standard");
  const [now, setNow] = useState(Date.now());

  const setById = useMemo(
    () => new Map(sets.map((set) => [set.id, set])),
    [sets]
  );

  const selectedItems = useMemo(
    () =>
      Object.values(selected)
        .map((item) => {
          const set = setById.get(item.setId);
          if (!set) return null;
          const quantity = parseSelectedQuantity(item.quantity);
          const bonusOption = set.bonusOptions.find(
            (option) => option.type === item.redemptionType
          );
          const nexValue =
            item.redemptionType === "standard"
              ? set.nexValue
              : bonusOption?.nexValue || 0;
          if (item.redemptionType !== "standard" && !bonusOption) {
            return null;
          }
          return {
            set,
            redemptionType: item.redemptionType,
            label: bonusOption?.label || "แบบธรรมดา",
            nexValue,
            quantity,
            lineTotalNex: nexValue * quantity,
          };
        })
        .filter(
          (
            item
          ): item is {
            set: CardSetItem;
            redemptionType: CardSetRedemptionType;
            label: string;
            nexValue: number;
            quantity: number;
            lineTotalNex: number;
          } => item !== null && item.quantity > 0
        ),
    [selected, setById]
  );

  const selectedSetCount = selectedItems.length;
  const selectedQuantity = selectedItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  const selectedTotalNex = selectedItems.reduce(
    (sum, item) => sum + item.lineTotalNex,
    0
  );

  const syncActive = useCallback(async () => {
    try {
      const res = await fetch(`/api/card-set-redemptions?ts=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const nextActive = (data?.active || null) as Redemption | null;
      setActive(nextActive);
      if (nextActive) setModalOpen(true);
    } catch {
      return;
    }
  }, []);

  const syncRedemption = useCallback(async (code: string) => {
    try {
      const res = await fetch(
        `/api/card-set-redemptions/${encodeURIComponent(code)}?ts=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data?.redemption) setActive(data.redemption);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    void syncActive();
  }, [syncActive]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!active || active.status !== "pending") return;
    const interval = window.setInterval(() => {
      void syncRedemption(active.code);
    }, 2500);
    return () => window.clearInterval(interval);
  }, [active, syncRedemption]);

  useEffect(() => {
    const remainingImages = sets
      .filter((set) => !set.priorityImage)
      .map((set) => set.coverImage);

    const preload = () => {
      remainingImages.forEach((src) => {
        const image = new window.Image();
        image.decoding = "async";
        image.loading = "eager";
        image.src = src;
      });
    };

    const timeoutId = window.setTimeout(preload, 900);
    return () => window.clearTimeout(timeoutId);
  }, [sets]);

  const filteredSets = useMemo(() => {
    const keyword = normalize(query);
    if (!keyword) return sets;

    return sets.filter((set) =>
      [
        set.name,
        set.subtitle,
        set.story,
        set.reward,
        String(set.order),
        `set ${set.order}`,
      ]
        .map(normalize)
        .some((field) => field.includes(keyword))
    );
  }, [query, sets]);

  const remainingMs = active
    ? new Date(active.expiresAt).getTime() - now
    : 0;
  const isPending = active?.status === "pending" && remainingMs > 0;
  const completed = active?.status === "approved";
  const activeItems =
    active?.items?.length && active.items.length > 0
      ? active.items
      : active
        ? [
            {
              setId: active.setId,
              setOrder: active.setOrder,
              setName: active.setName,
              rewardLabel: active.rewardLabel,
              redemptionType: active.redemptionType,
              conditionLabel: active.conditionLabel,
              nexValue: active.nexValue,
              quantity: 1,
              lineTotalNex: active.nexValue,
            },
          ]
        : [];

  function toggleMultiMode() {
    setMultiMode((current) => {
      const next = !current;
      if (!next) {
        setSelected({});
        setAdminMode(false);
      }
      setError("");
      return next;
    });
  }

  function toggleAdminMode() {
    if (!canUseAdminMode || isPending) return;
    setAdminMode((current) => {
      const next = !current;
      if (next) setMultiMode(true);
      setError("");
      return next;
    });
  }

  function toggleSet(set: CardSetItem) {
    if (!multiMode || isPending) return;
    const key = selectionKey(set.id, "standard");
    setSelected((current) => {
      const next = { ...current };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = {
          setId: set.id,
          redemptionType: "standard",
          quantity: "1",
        };
      }
      return next;
    });
  }

  function toggleBonusOption(
    set: CardSetItem,
    redemptionType: Exclude<CardSetRedemptionType, "standard">
  ) {
    if (!multiMode || isPending) return;
    const key = selectionKey(set.id, redemptionType);
    setSelected((current) => {
      const next = { ...current };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = {
          setId: set.id,
          redemptionType,
          quantity: "1",
        };
      }
      return next;
    });
  }

  function updateQuantity(
    setId: string,
    redemptionType: CardSetRedemptionType,
    value: string
  ) {
    const quantity = normalizeQuantityInput(value);
    const key = selectionKey(setId, redemptionType);
    setSelected((current) =>
      current[key]
        ? {
            ...current,
            [key]: {
              setId,
              redemptionType,
              quantity,
            },
          }
        : current
    );
  }

  async function createRedemption(set: CardSetItem) {
    const redemptionType = set.bonusOptions.some(
      (option) => option.type === selectedRedemptionType
    )
      ? selectedRedemptionType
      : "standard";

    await createQr([{ setId: set.id, redemptionType, quantity: 1 }], () => {
      setConfirmSet(null);
      setSelectedRedemptionType("standard");
    });
  }

  async function createMultiRedemption() {
    const validItems = selectedItems.filter((item) => item.quantity > 0);

    if (!validItems.length) {
      setError("เลือกเซ็ตอย่างน้อย 1 เซ็ตก่อนสร้าง QR");
      return;
    }

    await createQr(
      validItems.map(({ set, redemptionType, quantity }) => ({
        setId: set.id,
        redemptionType,
        quantity,
      })),
      () => {
        setSelected({});
        setMultiMode(false);
        setAdminMode(false);
      }
    );
  }

  async function createQr(
    items: Array<{
      setId: string;
      redemptionType: CardSetRedemptionType;
      quantity: number;
    }>,
    onSuccess: () => void
  ) {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/card-set-redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, adminMode }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(String(data?.error || "สร้าง QR ไม่สำเร็จ"));
        return;
      }

      setActive(data?.active || null);
      setModalOpen(Boolean(data?.active));
      onSuccess();
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างสร้าง QR");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#050507] pb-[calc(var(--app-mobile-nav-height)_+_170px)] text-white xl:pb-28">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(251,191,36,0.16),transparent_26%),linear-gradient(180deg,#0b0b10_0%,#050507_100%)]" />

      <div className="relative mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 xl:px-6">
        <section className="overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.96))] p-4 shadow-[0_32px_120px_rgba(0,0,0,0.48)] sm:rounded-[34px] sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/rewards"
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white/82 transition hover:border-amber-300/24 hover:text-amber-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Rewards
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleMultiMode}
                disabled={Boolean(isPending)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  multiMode
                    ? "bg-amber-300 text-black shadow-[0_0_24px_rgba(251,191,36,0.28)]"
                    : "border border-amber-200/22 bg-amber-200/10 text-amber-100"
                }`}
              >
                <Layers3 className="h-4 w-4" />
                เลือกหลายเซ็ต
              </button>
              {canUseAdminMode ? (
                <button
                  type="button"
                  onClick={toggleAdminMode}
                  disabled={Boolean(isPending)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    adminMode
                      ? "bg-cyan-300 text-black shadow-[0_0_24px_rgba(34,211,238,0.26)]"
                      : "border border-cyan-200/22 bg-cyan-200/10 text-cyan-100"
                  }`}
                >
                  <ScanLine className="h-4 w-4" />
                  โหมดแอดมิน
                </button>
              ) : null}
              <div className="rounded-full border border-amber-300/18 bg-amber-300/10 px-4 py-2 text-xs font-black text-amber-200">
                {formatNumber(sets.length)} CARD SET
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-[10px] font-black uppercase text-white/48 ring-1 ring-white/8">
              <Trophy className="h-3.5 w-3.5 text-amber-300" />
              Collection Rewards
            </div>
            <h1 className="mt-4 text-4xl font-black sm:text-6xl">CARD SET</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-bold leading-6 text-white/55 sm:text-base">
              เลือกเซ็ตที่นำการ์ดจริงมาแลกที่หน้าร้าน แล้วให้พนักงานสแกน QR ภายใน 1 ชั่วโมง
            </p>
          </div>

          <div className="mx-auto mt-6 max-w-3xl rounded-[28px] bg-black p-2 ring-1 ring-white/10">
            <div className="flex min-h-[66px] items-center gap-3 px-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-black">
                <Search className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase text-white/38">
                  Search Card Set
                </div>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ค้นหาเซ็ตการ์ด"
                  className="mt-1 w-full bg-transparent text-lg font-black outline-none placeholder:text-white/38"
                />
              </div>
            </div>
          </div>
        </section>

        {active && !modalOpen ? (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="sticky top-3 z-40 mt-4 flex w-full items-center justify-between gap-3 rounded-[24px] border border-amber-300/24 bg-[#121016]/95 px-4 py-3 text-left shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl"
          >
            <span>
              <span className="block text-xs font-black uppercase text-amber-200">
                Active Card Set QR
              </span>
              <span className="mt-1 block text-sm font-bold text-white/70">
                {active.itemCount > 1
                  ? `${active.itemCount} เซ็ต / ${active.totalQuantity} ชุด`
                  : `Set ${active.setOrder} ${active.setName}`}
              </span>
            </span>
            <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-black">
              {isPending ? formatRemaining(remainingMs) : active.statusLabel}
            </span>
          </button>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-[24px] border border-red-400/18 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            {error}
          </div>
        ) : null}

        <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredSets.map((set) => {
            const standardKey = selectionKey(set.id, "standard");
            const selectedSet = selected[standardKey];
            const selectedBonusOptions = set.bonusOptions.filter(
              (option) => selected[selectionKey(set.id, option.type)]
            );
            const hasAnySelection =
              Boolean(selectedSet) || selectedBonusOptions.length > 0;
            return (
              <article
                key={set.id}
                onClick={() => toggleSet(set)}
                className={`group relative overflow-hidden rounded-[28px] border bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.96))] p-3 shadow-[0_18px_70px_rgba(0,0,0,0.34)] transition duration-300 ${
                  hasAnySelection
                    ? "border-amber-300/70 shadow-[0_0_34px_rgba(251,191,36,0.18)]"
                    : "border-white/10 hover:-translate-y-1 hover:border-amber-300/24"
                } ${multiMode && !isPending ? "cursor-pointer" : ""}`}
              >
                {hasAnySelection ? (
                  <div className="absolute left-1/2 top-3 z-20 grid h-11 w-11 -translate-x-1/2 place-items-center rounded-full bg-[linear-gradient(135deg,#fff7ad,#fbbf24,#a16207)] text-black shadow-[0_0_28px_rgba(251,191,36,0.55)] ring-2 ring-white/40">
                    {selectedBonusOptions.length > 0 ? (
                      <span className="text-sm font-black">
                        {Number(Boolean(selectedSet)) +
                          selectedBonusOptions.length}
                      </span>
                    ) : (
                      <Check className="h-6 w-6 stroke-[4]" />
                    )}
                  </div>
                ) : null}

                <div className="relative overflow-hidden rounded-[22px] bg-white/[0.04] ring-1 ring-white/8">
                  <div className="absolute left-3 top-3 z-10 rounded-full bg-black/75 px-3 py-1.5 text-[10px] font-black uppercase text-white/72">
                    SET {set.order}
                  </div>
                  <div className="absolute right-3 top-3 z-10 rounded-full bg-amber-300/12 px-3 py-1.5 text-[10px] font-black uppercase text-amber-200 ring-1 ring-amber-300/18">
                    {set.finish === "foil" ? "FOIL" : set.tier}
                  </div>
                  <div className="relative aspect-[1.3]">
                    <img
                      src={set.coverImage}
                      alt={set.name}
                      loading={set.priorityImage ? "eager" : "lazy"}
                      fetchPriority={set.priorityImage ? "high" : "auto"}
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-contain object-center p-5 transition duration-500 group-hover:scale-105"
                      onError={(event) => {
                        const image = event.currentTarget;
                        const usedFallback =
                          image.dataset.fallbackUsed === "true";

                        if (!usedFallback && set.fallbackImage) {
                          image.dataset.fallbackUsed = "true";
                          image.src = set.fallbackImage;
                          return;
                        }

                        image.src = "/avatar.png";
                      }}
                    />
                  </div>
                </div>

                <div className="px-1 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-[10px] font-black uppercase text-white/52 ring-1 ring-white/8">
                      <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                      {set.stars}
                    </span>
                    <span className="rounded-full bg-white/[0.05] px-3 py-1.5 text-[10px] font-black text-white/52 ring-1 ring-white/8">
                      {formatNumber(set.totalCards)} cards
                    </span>
                  </div>
                  <h2 className="mt-3 line-clamp-2 min-h-[3.25rem] text-xl font-black leading-tight sm:text-2xl">
                    {set.name}
                  </h2>
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm font-bold leading-5 text-white/48">
                    {set.subtitle}
                  </p>
                  <div className="mt-3 rounded-[18px] border border-amber-200/14 bg-amber-200/[0.06] px-3 py-2 text-xs font-bold leading-5 text-amber-50/78">
                    {set.story}
                  </div>

                  {multiMode ? (
                    <div
                      className="mt-3 rounded-[20px] border border-amber-200/18 bg-amber-200/8 p-3"
                      onClick={(event) => event.stopPropagation()}
                      onMouseDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                    >
                      <label className="text-[10px] font-black uppercase text-amber-100/70">
                        จำนวนเซ็ตนี้
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={selectedSet?.quantity ?? ""}
                        disabled={!selectedSet}
                        onChange={(event) =>
                          updateQuantity(
                            set.id,
                            "standard",
                            event.target.value
                          )
                        }
                        className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/55 px-4 text-lg font-black text-white outline-none disabled:opacity-45"
                      />
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-[22px] bg-white px-4 py-4 text-black">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-black/38">
                      <Gem className="h-3.5 w-3.5 text-amber-500" />
                      Reward Value
                    </div>
                    <div className="mt-2 text-xl font-black">
                      {set.nexValue > 0
                        ? `${formatNumber(set.nexValue)} NEX`
                        : set.reward}
                    </div>
                    {multiMode ? (
                      <div className="mt-1 text-xs font-bold text-black/48">
                        รวมตามจำนวน:{" "}
                        {formatNumber(
                          set.nexValue *
                            parseSelectedQuantity(selectedSet?.quantity)
                        )}{" "}
                        NEX
                        {set.bonusOptions.length > 0 ? (
                          <div className="mt-3 grid gap-2">
                            {set.bonusOptions.map((option) => {
                              const optionKey = selectionKey(
                                set.id,
                                option.type
                              );
                              const optionSelected = Boolean(
                                selected[optionKey]
                              );

                              return (
                                <button
                                  key={option.type}
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleBonusOption(set, option.type);
                                  }}
                                  onMouseDown={(event) =>
                                    event.stopPropagation()
                                  }
                                  className={`flex w-full items-start gap-2 rounded-2xl border px-3 py-2 text-left transition ${
                                    optionSelected
                                      ? "border-amber-500/65 bg-amber-300 text-black shadow-[0_0_18px_rgba(251,191,36,0.25)]"
                                      : "border-black/10 bg-black/[0.06] text-black hover:border-amber-500/45"
                                  }`}
                                >
                                  <span
                                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                                      optionSelected
                                        ? "border-black bg-black text-amber-200"
                                        : "border-black/25 bg-white"
                                    }`}
                                  >
                                    {optionSelected ? (
                                      <Check className="h-3.5 w-3.5" />
                                    ) : null}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="line-clamp-2 text-[11px] font-black leading-4">
                                      {option.label}
                                    </span>
                                    <span className="mt-1 inline-flex rounded-full bg-black px-2.5 py-1 text-[10px] font-black text-amber-200">
                                      {formatNumber(option.nexValue)} NEX
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : set.bonusOptions.length > 0 ? (
                      <div className="mt-2 rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-black text-amber-800">
                        เงื่อนไขเสริม {set.bonusOptions.length} แบบ
                      </div>
                    ) : null}
                  </div>

                  {!multiMode ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRedemptionType("standard");
                        setConfirmSet(set);
                      }}
                      disabled={loading || Boolean(active && isPending)}
                      className="mt-4 inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[22px] bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-4 py-3 text-sm font-black text-black shadow-[0_0_28px_rgba(250,204,21,0.24)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <QrCode className="h-4 w-4" />
                      แลกเปลี่ยนเป็นรางวัล
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      </div>

      {multiMode ? (
        <div className="fixed inset-x-0 bottom-[calc(var(--app-mobile-nav-height)_+_18px)] z-[1260] px-3 xl:bottom-6">
          <div className="mx-auto flex max-w-4xl flex-col gap-3 rounded-[24px] border border-amber-200/24 bg-[#111014]/95 p-3 shadow-[0_-18px_70px_rgba(0,0,0,0.52)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase text-amber-100/70">
                เลือกแล้ว
              </div>
              <div className="mt-1 text-lg font-black">
                {selectedSetCount} เซ็ต / {selectedQuantity} ชุด
              </div>
              <div className="text-sm font-bold text-white/55">
                รวม {formatNumber(selectedTotalNex)} NEX
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelected({})}
                className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-white sm:px-4 sm:text-sm"
              >
                ล้างที่เลือก
              </button>
              <button
                type="button"
                onClick={() => void createMultiRedemption()}
                disabled={
                  selectedQuantity < 1 || loading || Boolean(isPending)
                }
                className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-[linear-gradient(135deg,#fff7ad,#fbbf24,#a16207)] px-3 text-xs font-black text-black shadow-[0_0_26px_rgba(251,191,36,0.28)] disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-5 sm:text-sm"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4" />
                )}
                แลกเปลี่ยนรางวัล
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmSet ? (
        <div className="fixed inset-0 z-[1300] flex items-end justify-center overflow-y-auto bg-black/72 p-3 pb-[calc(12px_+_env(safe-area-inset-bottom))] pt-[calc(12px_+_env(safe-area-inset-top))] backdrop-blur-xl sm:items-center">
          <div className="max-h-[calc(100dvh_-_24px_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] w-full max-w-lg overflow-y-auto rounded-[30px] border border-white/12 bg-[#101016] p-5 text-white shadow-[0_30px_120px_rgba(0,0,0,0.62)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase text-amber-200">
                  Confirm Card Set
                </div>
                <h2 className="mt-2 text-2xl font-black">
                  ยืนยันการแลกเซ็ตที่ {confirmSet.order}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setConfirmSet(null)}
                className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 rounded-[24px] bg-white p-4 text-black">
              <div className="text-xl font-black">{confirmSet.name}</div>
              <div className="mt-1 text-sm font-bold text-black/48">
                {confirmSet.reward}
              </div>
              <div className="mt-3 rounded-2xl bg-black/[0.05] px-3 py-2 text-xs font-bold leading-5 text-black/62">
                {confirmSet.story}
              </div>
            </div>

            {confirmSet.bonusOptions.length > 0 ? (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedRedemptionType("standard")}
                  className={`flex w-full items-start gap-3 rounded-[24px] border p-4 text-left transition ${
                    selectedRedemptionType === "standard"
                      ? "border-amber-300/45 bg-amber-300/12 ring-1 ring-amber-300/18"
                      : "border-white/10 bg-white/[0.04]"
                  }`}
                >
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                      selectedRedemptionType === "standard"
                        ? "border-amber-300 bg-amber-300 text-black"
                        : "border-white/30"
                    }`}
                  >
                    {selectedRedemptionType === "standard" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-white">
                      แลกแบบธรรมดา
                    </span>
                    <span className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-black">
                      {formatNumber(confirmSet.nexValue)} NEX
                    </span>
                  </span>
                </button>
                {confirmSet.bonusOptions.map((option) => (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => setSelectedRedemptionType(option.type)}
                    className={`flex w-full items-start gap-3 rounded-[24px] border p-4 text-left transition ${
                      selectedRedemptionType === option.type
                        ? "border-amber-300/45 bg-amber-300/12 ring-1 ring-amber-300/18"
                        : "border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                        selectedRedemptionType === option.type
                          ? "border-amber-300 bg-amber-300 text-black"
                          : "border-white/30"
                      }`}
                    >
                      {selectedRedemptionType === option.type ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-amber-100">
                        {option.label}
                      </span>
                      <span className="mt-2 inline-flex rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-black">
                        รวมเป็น {formatNumber(option.nexValue)} NEX
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void createRedemption(confirmSet)}
                disabled={loading}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[22px] bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-4 text-sm font-black text-black disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                แลกเปลี่ยนเป็นรางวัล
              </button>
              <button
                type="button"
                onClick={() => setConfirmSet(null)}
                className="min-h-[52px] rounded-[22px] border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {active && modalOpen ? (
        <div className="fixed inset-0 z-[5000] flex items-end justify-center overflow-y-auto bg-black/78 p-3 pb-[calc(12px_+_env(safe-area-inset-bottom))] pt-[calc(12px_+_env(safe-area-inset-top))] backdrop-blur-xl sm:items-center">
          <div className="relative max-h-[calc(100dvh_-_24px_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] w-full max-w-xl overflow-y-auto rounded-[32px] border border-white/12 bg-[#101016] p-4 text-white shadow-[0_30px_120px_rgba(0,0,0,0.62)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase text-amber-200">
                  Card Set Redemption
                </div>
                <h2 className="mt-2 break-words text-2xl font-black leading-tight sm:text-3xl">
                  {active.itemCount > 1
                    ? `${active.itemCount} เซ็ต / ${active.totalQuantity} ชุด`
                    : `Set ${active.setOrder} ${active.setName}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-amber-200/30 bg-black/70 text-white shadow-[0_0_30px_rgba(250,204,21,0.18)] ring-1 ring-white/10 backdrop-blur-xl transition active:scale-95"
                aria-label="Close QR"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div
              className={`mt-5 rounded-[28px] p-5 text-center ${
                completed
                  ? "bg-emerald-400 text-black"
                  : active.status === "cancelled" || active.status === "expired"
                    ? "bg-red-50 text-red-900"
                    : "bg-white text-black"
              }`}
            >
              {completed ? (
                <div className="grid place-items-center gap-3 py-8">
                  <CheckCircle2 className="h-16 w-16" />
                  <div className="text-3xl font-black">การแลกเสร็จสมบูรณ์</div>
                  <div className="text-sm font-bold opacity-70">
                    พนักงานอนุมัติรายการนี้แล้ว
                  </div>
                </div>
              ) : active.status === "cancelled" || active.status === "expired" ? (
                <div className="grid place-items-center gap-3 py-8">
                  <Clock3 className="h-16 w-16" />
                  <div className="text-3xl font-black">{active.statusLabel}</div>
                  <div className="text-sm font-bold opacity-70">
                    กรุณาสร้าง QR ใหม่เมื่อต้องการแลกอีกครั้ง
                  </div>
                </div>
              ) : (
                <>
                  <div className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-[10px] font-black uppercase text-white">
                    <QrCode className="h-3.5 w-3.5 text-amber-300" />
                    {active.createdByAdminMode ? "Customer Scan" : "Staff Scan Only"}
                  </div>
                  <div className="mt-4 flex justify-center">
                    <div className="rounded-[24px] bg-white p-3 shadow-[0_16px_44px_rgba(0,0,0,0.14)] ring-1 ring-black/8">
                      <QRCodeCanvas value={active.code} size={210} />
                    </div>
                  </div>
                  <div className="mt-4 break-all rounded-[20px] bg-black px-4 py-3 text-sm font-black text-white">
                    {active.code}
                  </div>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-black">
                    <Clock3 className="h-4 w-4" />
                    {formatRemaining(remainingMs)}
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase text-white/35">
                    Total Reward
                  </div>
                  <div className="mt-2 text-2xl font-black text-amber-200">
                    {active.valueLabel}
                  </div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-right text-black">
                  <div className="text-[10px] font-black uppercase text-black/45">
                    Sets
                  </div>
                  <div className="text-lg font-black">
                    {active.totalQuantity || 1}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              {activeItems.map((item) => (
                <div
                  key={`${item.setId}-${item.redemptionType}`}
                  className="rounded-[20px] border border-white/8 bg-black/20 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-black">
                        Set {item.setOrder} {item.setName}
                      </div>
                      <div className="mt-1 text-xs font-bold text-white/50">
                        {formatNumber(item.nexValue)} NEX x {item.quantity} ชุด
                      </div>
                      {item.conditionLabel ? (
                        <div className="mt-1 text-xs font-bold text-amber-100/70">
                          {item.conditionLabel}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right text-sm font-black text-amber-100">
                      {formatNumber(item.lineTotalNex)} NEX
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[22px] border border-white/12 bg-white/[0.06] px-4 text-sm font-black text-white shadow-[0_14px_34px_rgba(0,0,0,0.22)] transition active:scale-[0.99] sm:hidden"
            >
              <X className="h-4 w-4" />
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
