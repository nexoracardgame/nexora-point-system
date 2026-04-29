"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Calculator,
  Check,
  CircleAlert,
  Gem,
  Layers3,
  ListChecks,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Trophy,
  WalletCards,
  X,
} from "lucide-react";
import {
  getCollectionCardIds,
  NEXORA_COLLECTION_SOURCE_URL,
  nexoraCollectionSets,
  rarityStyles,
} from "@/lib/nexora-collection-sets";

type CalculatorState = {
  bronze: number;
  silver: number;
  gold: number;
};

type StoredCollectionsState = {
  ownedCards: number[];
  calculator: CalculatorState;
  selectedSetId: string;
};

type RemoteCollectionsState = Partial<StoredCollectionsState> & {
  updatedAt?: string | null;
};

const STORAGE_KEY = "nexora:collections:v2";
const PREVIEW_CARD_LIMIT = 8;
const emptyCalculator: CalculatorState = { bronze: 0, silver: 0, gold: 0 };

function formatCardNo(cardId: number) {
  return String(cardId).padStart(3, "0");
}

function normalizeCount(value: string) {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.min(numeric, 999999);
}

function parseCardNumbers(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[^0-9]+/)
        .map((item) => Number.parseInt(item, 10))
        .filter((item) => Number.isFinite(item) && item >= 1 && item <= 293)
    )
  ).sort((a, b) => a - b);
}

function normalizeCalculatorState(value: unknown): CalculatorState {
  const source =
    value && typeof value === "object"
      ? (value as Partial<Record<keyof CalculatorState, unknown>>)
      : {};

  return {
    bronze: Math.max(0, Number(source.bronze || 0)),
    silver: Math.max(0, Number(source.silver || 0)),
    gold: Math.max(0, Number(source.gold || 0)),
  };
}

function hasCalculatorValue(value: CalculatorState) {
  return value.bronze > 0 || value.silver > 0 || value.gold > 0;
}

function readStoredState(): StoredCollectionsState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredCollectionsState>;
    return {
      ownedCards: Array.isArray(parsed.ownedCards)
        ? parseCardNumbers(parsed.ownedCards.join(","))
        : [],
      calculator: normalizeCalculatorState(parsed.calculator),
      selectedSetId:
        String(parsed.selectedSetId || "").trim() ||
        nexoraCollectionSets[0]?.id ||
        "",
    };
  } catch {
    return null;
  }
}

export default function CollectionsClient() {
  const [ownedCards, setOwnedCards] = useState<number[]>([]);
  const [calculator, setCalculator] = useState<CalculatorState>(emptyCalculator);
  const [cardInput, setCardInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSetId, setSelectedSetId] = useState(
    nexoraCollectionSets[0]?.id || ""
  );
  const [message, setMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [remoteSynced, setRemoteSynced] = useState(false);
  const [showAllPreviewCards, setShowAllPreviewCards] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const stored = readStoredState();
      if (stored) {
        setOwnedCards(stored.ownedCards);
        setCalculator(stored.calculator);
        setSelectedSetId(stored.selectedSetId);
      }
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ownedCards,
        calculator,
        selectedSetId,
      } satisfies StoredCollectionsState)
    );
  }, [calculator, hydrated, ownedCards, selectedSetId]);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    const loadRemoteState = async () => {
      try {
        const response = await fetch("/api/collections/state", {
          cache: "no-store",
        });

        if (!response.ok || cancelled) return;

        const payload = (await response.json().catch(() => null)) as {
          state?: RemoteCollectionsState;
        } | null;

        const state = payload?.state;
        if (!state || cancelled) return;

        if (Array.isArray(state.ownedCards) && state.ownedCards.length > 0) {
          const remoteOwned = parseCardNumbers(state.ownedCards.join(","));
          setOwnedCards((current) =>
            Array.from(new Set([...current, ...remoteOwned])).sort(
              (a, b) => a - b
            )
          );
        }

        const remoteCalculator = normalizeCalculatorState(state.calculator);
        if (hasCalculatorValue(remoteCalculator)) {
          setCalculator(remoteCalculator);
        }

        const remoteSelectedSetId = String(state.selectedSetId || "").trim();
        if (
          remoteSelectedSetId &&
          nexoraCollectionSets.some((set) => set.id === remoteSelectedSetId)
        ) {
          setSelectedSetId(remoteSelectedSetId);
          setShowAllPreviewCards(false);
        }
      } finally {
        if (!cancelled) setRemoteSynced(true);
      }
    };

    void loadRemoteState();

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !remoteSynced) return;

    const timeoutId = window.setTimeout(() => {
      void fetch("/api/collections/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownedCards, calculator, selectedSetId }),
      }).catch(() => undefined);
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [calculator, hydrated, ownedCards, remoteSynced, selectedSetId]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const stored = readStoredState();
      if (!stored) return;
      setOwnedCards(stored.ownedCards);
      setCalculator(stored.calculator);
      setSelectedSetId(stored.selectedSetId);
      setShowAllPreviewCards(false);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const ownedSet = useMemo(() => new Set(ownedCards), [ownedCards]);

  const setStats = useMemo(
    () =>
      nexoraCollectionSets.map((set) => {
        const cardIds = getCollectionCardIds(set);
        const owned = cardIds.filter((cardId) => ownedSet.has(cardId));
        const missing = cardIds.filter((cardId) => !ownedSet.has(cardId));
        const progress = cardIds.length
          ? Math.round((owned.length / cardIds.length) * 100)
          : 0;

        return {
          set,
          cardIds,
          displayTotal: set.officialTotal || cardIds.length,
          owned,
          missing,
          progress,
        };
      }),
    [ownedSet]
  );

  const filteredStats = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return setStats;
    return setStats.filter(({ set }) => {
      const haystack = `${set.name} ${set.subtitle} ${set.reward} ${set.order}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [searchTerm, setStats]);

  const activeStat =
    setStats.find((item) => item.set.id === selectedSetId) || setStats[0];

  const nearComplete = useMemo(
    () =>
      setStats
        .filter((item) => item.owned.length > 0 && item.missing.length > 0)
        .sort((a, b) => {
          if (a.missing.length !== b.missing.length) {
            return a.missing.length - b.missing.length;
          }
          return b.progress - a.progress;
        })
        .slice(0, 5),
    [setStats]
  );

  const completedCount = setStats.filter((item) => item.progress >= 100).length;
  const totalTrackedCards = useMemo(
    () =>
      new Set(setStats.flatMap((item) => item.cardIds)).size,
    [setStats]
  );
  const nexTotal =
    calculator.bronze * 0.5 + calculator.silver * 1 + calculator.gold * 2;

  const updateCalculator = (key: keyof CalculatorState, value: string) => {
    setCalculator((prev) => ({
      ...prev,
      [key]: normalizeCount(value),
    }));
  };

  const addCards = () => {
    const parsed = parseCardNumbers(cardInput);
    if (parsed.length === 0) {
      setMessage("กรอกเลขการ์ด 001-293 ก่อนครับ");
      return;
    }

    setOwnedCards((prev) =>
      Array.from(new Set([...prev, ...parsed])).sort((a, b) => a - b)
    );
    setCardInput("");
    setMessage(`เพิ่ม ${parsed.length.toLocaleString("th-TH")} ใบแล้ว`);
  };

  const toggleCard = (cardId: number) => {
    setOwnedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return Array.from(next).sort((a, b) => a - b);
    });
  };

  const markSetComplete = () => {
    if (!activeStat) return;
    setOwnedCards((prev) =>
      Array.from(new Set([...prev, ...activeStat.cardIds])).sort((a, b) => a - b)
    );
    setMessage(`มาร์กชุด ${activeStat.set.order} ครบแล้ว`);
  };

  const clearSet = () => {
    if (!activeStat) return;
    const setCardIds = new Set(activeStat.cardIds);
    setOwnedCards((prev) => prev.filter((cardId) => !setCardIds.has(cardId)));
    setMessage(`ล้างการ์ดของชุด ${activeStat.set.order} แล้ว`);
  };

  const selectSet = (setId: string) => {
    setSelectedSetId(setId);
    setShowAllPreviewCards(false);
  };

  const previewCards =
    activeStat?.cardIds.slice(
      0,
      showAllPreviewCards ? activeStat.cardIds.length : PREVIEW_CARD_LIMIT
    ) || [];
  const hiddenPreviewCount = activeStat
    ? Math.max(activeStat.cardIds.length - previewCards.length, 0)
    : 0;

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#080808]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(255,255,255,0.96),transparent_26%),radial-gradient(circle_at_82%_0%,rgba(255,226,126,0.34),transparent_20%),linear-gradient(180deg,#fbfaf6_0%,#ebe6da_100%)]" />
      <div className="relative mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-6 xl:max-w-none xl:px-0">
        <section className="overflow-hidden rounded-[30px] bg-white shadow-[0_28px_90px_rgba(50,43,33,0.16)] ring-1 ring-black/5 sm:rounded-[44px]">
          <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr] xl:grid-cols-[minmax(0,1.22fr)_minmax(420px,0.78fr)]">
            <div className="relative min-h-[420px] overflow-hidden bg-[#080808] px-5 py-6 text-white sm:px-8 sm:py-8 lg:px-10 xl:min-h-[480px] xl:px-12 xl:py-10 2xl:px-14">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_16%,rgba(255,255,255,0.18),transparent_22%),linear-gradient(135deg,rgba(255,212,89,0.18),transparent_34%)]" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-black shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
                  <Layers3 className="h-3.5 w-3.5" />
                  19 Official Sets
                </div>
                <h1 className="mt-5 text-5xl font-black leading-[0.9] tracking-[-0.09em] sm:text-7xl lg:text-8xl">
                  COLLECTIONS
                </h1>
                <p className="mt-5 max-w-2xl text-base font-bold leading-7 text-white/68 sm:text-lg">
                  คำนวณ NEX และเช็กคอลเลกชันการ์ดทุกชุดในหน้าเดียว เห็นทันทีว่าชุดไหนใกล้ครบ ขาดเลขอะไร และมีอะไรอยู่แล้ว
                </p>

                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[24px] bg-white/10 p-4 ring-1 ring-white/10">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                      Owned
                    </div>
                    <div className="mt-2 text-3xl font-black">
                      {ownedCards.length.toLocaleString("th-TH")}
                    </div>
                  </div>
                  <div className="rounded-[24px] bg-white/10 p-4 ring-1 ring-white/10">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                      Complete
                    </div>
                    <div className="mt-2 text-3xl font-black">
                      {completedCount.toLocaleString("th-TH")}
                    </div>
                  </div>
                  <div className="rounded-[24px] bg-[#f5c542] p-4 text-black">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/48">
                      NEX
                    </div>
                    <div className="mt-2 text-3xl font-black">
                      {nexTotal.toLocaleString("th-TH", {
                        maximumFractionDigits: 1,
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#f8f6ef] p-4 sm:p-6 lg:p-7 xl:p-8 2xl:p-9">
              <div className="rounded-[28px] bg-white p-4 shadow-[0_18px_50px_rgba(20,18,14,0.08)] ring-1 ring-black/5 sm:p-5 xl:min-h-full xl:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-black/35">
                      NEX Calculator
                    </div>
                    <h2 className="mt-1 text-3xl font-black tracking-[-0.06em]">
                      คำนวณ NEX
                    </h2>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-black text-white">
                    <Calculator className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {[
                    { key: "bronze" as const, label: "บรอนซ์", rate: "0.5 NEX" },
                    { key: "silver" as const, label: "ซิลเวอร์", rate: "1 NEX" },
                    { key: "gold" as const, label: "โกลด์", rate: "2 NEX" },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="grid grid-cols-[1fr_120px] items-center gap-3 rounded-[22px] bg-[#f3f1ea] px-4 py-3 ring-1 ring-black/5 sm:grid-cols-[1fr_150px]"
                    >
                      <span>
                        <span className="block text-base font-black">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-xs font-bold text-black/42">
                          1 ใบ = {item.rate}
                        </span>
                      </span>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={calculator[item.key]}
                        onChange={(event) =>
                          updateCalculator(item.key, event.target.value)
                        }
                        className="h-12 rounded-[16px] bg-white px-3 text-right text-xl font-black outline-none ring-1 ring-black/8 focus:ring-2 focus:ring-black"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-5 rounded-[26px] bg-black px-5 py-5 text-white">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/40">
                    Total Value
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="text-5xl font-black tracking-[-0.08em]">
                      {nexTotal.toLocaleString("th-TH", {
                        maximumFractionDigits: 1,
                      })}
                    </div>
                    <div className="pb-1 text-xl font-black text-[#f5c542]">
                      NEX
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(360px,0.78fr)_minmax(0,1.22fr)] xl:items-start 2xl:grid-cols-[minmax(420px,0.72fr)_minmax(0,1.28fr)]">
          <div className="space-y-5 xl:col-start-1 xl:row-start-1">
            <div className="rounded-[30px] bg-white p-4 shadow-[0_22px_70px_rgba(50,43,33,0.12)] ring-1 ring-black/5 sm:p-5 xl:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-black/35">
                    My Cards
                  </div>
                  <h2 className="mt-1 text-3xl font-black tracking-[-0.06em]">
                    การ์ดที่มี
                  </h2>
                </div>
                <WalletCards className="h-7 w-7 text-black/60" />
              </div>

              <div className="mt-4 flex min-h-[58px] items-center gap-2 rounded-[20px] bg-black p-2 pl-4 text-white">
                <Search className="h-5 w-5 shrink-0 text-white/55" />
                <input
                  value={cardInput}
                  onChange={(event) => setCardInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addCards();
                  }}
                  placeholder="เช่น 001, 006, 209"
                  className="min-w-0 flex-1 bg-transparent text-base font-bold outline-none placeholder:text-white/38"
                />
                <button
                  type="button"
                  onClick={addCards}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-white text-black transition hover:scale-[1.03]"
                  aria-label="เพิ่มเลขการ์ด"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              {message ? (
                <div className="mt-3 flex items-center gap-2 rounded-[18px] bg-[#f3f1ea] px-4 py-3 text-sm font-black text-black/64">
                  <CircleAlert className="h-4 w-4" />
                  {message}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {ownedCards.length === 0 ? (
                  <div className="rounded-[18px] bg-[#f3f1ea] px-4 py-3 text-sm font-bold text-black/45">
                    ยังไม่มีเลขการ์ดในคอลเลกชัน
                  </div>
                ) : (
                  <>
                    {ownedCards.slice(0, 60).map((cardId) => (
                      <button
                        key={cardId}
                        type="button"
                        onClick={() => toggleCard(cardId)}
                        className="rounded-full bg-black px-3 py-1.5 text-xs font-black text-white transition hover:bg-red-500"
                      >
                        #{formatCardNo(cardId)}
                      </button>
                    ))}
                    {ownedCards.length > 60 ? (
                      <div className="rounded-full bg-[#f3f1ea] px-3 py-1.5 text-xs font-black text-black/48">
                        +{(ownedCards.length - 60).toLocaleString("th-TH")}
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setOwnedCards([])}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-red-50 px-4 text-sm font-black text-red-600 ring-1 ring-red-100 transition hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                  ล้างทั้งหมด
                </button>
              </div>
            </div>

            <div className="rounded-[30px] bg-[#080808] p-4 text-white shadow-[0_22px_70px_rgba(0,0,0,0.18)] sm:p-5 xl:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">
                    Closest Sets
                  </div>
                  <h2 className="mt-1 text-3xl font-black tracking-[-0.06em]">
                    ใกล้ครบที่สุด
                  </h2>
                </div>
                <Trophy className="h-7 w-7 text-[#f5c542]" />
              </div>

              <div className="mt-4 space-y-2">
                {nearComplete.length === 0 ? (
                  <div className="rounded-[22px] bg-white/8 px-4 py-4 text-sm font-bold text-white/48">
                    เพิ่มเลขการ์ดแล้วระบบจะจัดอันดับชุดที่ใกล้ครบให้ทันที
                  </div>
                ) : (
                  nearComplete.map((item) => (
                    <button
                      key={item.set.id}
                      type="button"
                      onClick={() => selectSet(item.set.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-[22px] bg-white/8 px-4 py-3 text-left transition hover:bg-white/12"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">
                          ชุด {item.set.order}: {item.set.name}
                        </span>
                        <span className="mt-1 block text-xs font-bold text-white/42">
                          ขาด {item.missing.length.toLocaleString("th-TH")} ใบ
                        </span>
                      </span>
                      <span className="shrink-0 text-lg font-black text-[#f5c542]">
                        {item.progress}%
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5 xl:contents">
            <div className="rounded-[30px] bg-white p-4 shadow-[0_22px_70px_rgba(50,43,33,0.12)] ring-1 ring-black/5 sm:p-5 xl:col-start-2 xl:row-start-1 xl:p-6 2xl:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-black/35">
                    Collection Sets
                  </div>
                  <h2 className="mt-1 text-3xl font-black tracking-[-0.06em]">
                    ชุดสะสมทั้งหมด
                  </h2>
                </div>
                <label className="flex h-12 items-center gap-2 rounded-full bg-[#f3f1ea] px-4 ring-1 ring-black/5 sm:w-[280px] xl:w-[340px]">
                  <Search className="h-4 w-4 shrink-0 text-black/45" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="ค้นหาชุด"
                    className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-black/35"
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {filteredStats.map((item) => (
                  <button
                    key={item.set.id}
                    type="button"
                    onClick={() => selectSet(item.set.id)}
                    className={`overflow-hidden rounded-[26px] p-3 text-left ring-1 transition xl:p-4 ${
                      item.set.id === activeStat?.set.id
                        ? "bg-black text-white ring-black"
                        : "bg-[#f6f4ee] text-black ring-black/5 hover:bg-[#efebe0]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] bg-white text-black shadow-sm xl:h-14 xl:w-14">
                        <span className="text-base font-black">
                          {item.set.order}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-lg font-black">
                              {item.set.name}
                            </div>
                            <div
                              className={`mt-1 line-clamp-1 text-xs font-bold ${
                                item.set.id === activeStat?.set.id
                                  ? "text-white/48"
                                  : "text-black/42"
                              }`}
                            >
                              {item.set.subtitle}
                            </div>
                          </div>
                          <div
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
                              item.progress >= 100
                                ? "bg-[#f5c542] text-black"
                                : item.set.id === activeStat?.set.id
                                  ? "bg-white/10 text-white"
                                  : "bg-white text-black"
                            }`}
                          >
                            {item.progress}%
                          </div>
                        </div>

                        <div
                          className={`mt-3 h-2 overflow-hidden rounded-full ${
                            item.set.id === activeStat?.set.id
                              ? "bg-white/12"
                              : "bg-black/8"
                          }`}
                        >
                          <div
                            className="h-full rounded-full bg-[#f5c542]"
                            style={{ width: `${Math.min(item.progress, 100)}%` }}
                          />
                        </div>
                        <div
                          className={`mt-2 text-xs font-black ${
                            item.set.id === activeStat?.set.id
                              ? "text-white/50"
                              : "text-black/42"
                          }`}
                        >
                          มี {item.owned.length.toLocaleString("th-TH")} /{" "}
                          {item.displayTotal.toLocaleString("th-TH")} ใบ
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {activeStat ? (
              <section className="overflow-hidden rounded-[30px] bg-[#080808] text-white shadow-[0_26px_90px_rgba(0,0,0,0.24)] xl:col-span-2 xl:col-start-1 xl:row-start-2">
                <div className="grid gap-0 xl:grid-cols-[minmax(420px,0.86fr)_minmax(0,1.14fr)] 2xl:grid-cols-[minmax(520px,0.82fr)_minmax(0,1.18fr)]">
                  <div className="relative min-h-[320px] overflow-hidden bg-[#121212] p-5 xl:min-h-[520px] xl:p-7 2xl:p-8">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_16%,rgba(245,197,66,0.22),transparent_24%),linear-gradient(180deg,transparent,rgba(0,0,0,0.52))]" />
                    <div className="relative">
                      <div className="flex items-center justify-between gap-3">
                        <div className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-black">
                          ชุด {activeStat.set.order}
                        </div>
                        <div className="rounded-full bg-[#f5c542] px-3 py-1.5 text-xs font-black text-black">
                          {activeStat.progress}%
                        </div>
                      </div>
                      <h3 className="mt-4 text-4xl font-black leading-none tracking-[-0.08em]">
                        {activeStat.set.name}
                      </h3>
                      <p className="mt-3 text-sm font-bold leading-6 text-white/58">
                        {activeStat.set.story}
                      </p>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">
                          Card Preview
                        </div>
                        {activeStat.cardIds.length > PREVIEW_CARD_LIMIT ? (
                          <button
                            type="button"
                            onClick={() =>
                              setShowAllPreviewCards((current) => !current)
                            }
                            className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-black transition hover:scale-[1.03]"
                          >
                            {showAllPreviewCards
                              ? "ย่อรูปการ์ด"
                              : `ดูรูปเพิ่ม +${hiddenPreviewCount.toLocaleString(
                                  "th-TH"
                                )}`}
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-4 xl:gap-3">
                        {previewCards.map((cardId, index) => {
                          const isOwned = ownedSet.has(cardId);

                          return (
                            <button
                              key={cardId}
                              type="button"
                              onClick={() => toggleCard(cardId)}
                              className={`group relative aspect-[5/7] overflow-hidden rounded-[16px] bg-white/10 text-left ring-1 transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c542] ${
                                isOwned
                                  ? "scale-[1.02] ring-[#f5c542] shadow-[0_0_0_2px_rgba(245,197,66,0.42),0_0_28px_rgba(245,197,66,0.56),0_16px_34px_rgba(0,0,0,0.42)]"
                                  : "ring-white/10 hover:scale-[1.02] hover:ring-white/40 hover:shadow-[0_14px_30px_rgba(0,0,0,0.32)]"
                              }`}
                              aria-pressed={isOwned}
                              aria-label={
                                isOwned
                                  ? `เอาการ์ด ${formatCardNo(cardId)} ออกจากคอลเลกชัน`
                                  : `เพิ่มการ์ด ${formatCardNo(cardId)} เข้าคอลเลกชัน`
                              }
                            >
                              <Image
                                src={`/cards/${formatCardNo(cardId)}.jpg`}
                                alt={`Card ${formatCardNo(cardId)}`}
                                fill
                                sizes="(max-width: 640px) 22vw, (max-width: 1279px) 96px, (max-width: 1535px) 10vw, 148px"
                                quality={72}
                                decoding="async"
                                className={`object-cover transition duration-200 ${
                                  isOwned
                                    ? "brightness-110 saturate-125"
                                    : "group-hover:brightness-110"
                                }`}
                                loading={index < 4 ? "eager" : "lazy"}
                              />
                              <div
                                className={`pointer-events-none absolute inset-0 rounded-[16px] transition ${
                                  isOwned
                                    ? "bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.34),transparent_24%),linear-gradient(180deg,rgba(245,197,66,0.22),transparent_45%,rgba(245,197,66,0.24))]"
                                    : "bg-black/0 group-hover:bg-white/5"
                                }`}
                              />
                              {isOwned ? (
                                <div className="pointer-events-none absolute inset-x-1.5 bottom-1.5 rounded-full bg-[#f5c542] px-2 py-1 text-center text-[9px] font-black text-black shadow-[0_8px_18px_rgba(0,0,0,0.34)]">
                                  มีแล้ว
                                </div>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 text-black sm:p-5 xl:p-6 2xl:p-7">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-black/35">
                          Set Tracker
                        </div>
                        <h3 className="mt-1 text-3xl font-black tracking-[-0.06em]">
                          {activeStat.set.subtitle}
                        </h3>
                      </div>
                      <div className="rounded-full bg-black px-4 py-2 text-sm font-black text-white">
                        ขาด {activeStat.missing.length.toLocaleString("th-TH")} ใบ
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[22px] bg-[#f3f1ea] p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">
                          Total
                        </div>
                        <div className="mt-1 text-2xl font-black">
                          {activeStat.displayTotal.toLocaleString("th-TH")}
                        </div>
                      </div>
                      <div className="rounded-[22px] bg-[#f3f1ea] p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">
                          Owned
                        </div>
                        <div className="mt-1 text-2xl font-black">
                          {activeStat.owned.length.toLocaleString("th-TH")}
                        </div>
                      </div>
                      <div className="rounded-[22px] bg-[#f5c542] p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/45">
                          Reward
                        </div>
                        <div className="mt-1 line-clamp-2 text-sm font-black">
                          {activeStat.set.reward}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {activeStat.set.groups.map((item) => {
                        const style = rarityStyles[item.type];
                        return (
                          <span
                            key={`${activeStat.set.id}-${item.type}-${item.label}`}
                            className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 ${style.className}`}
                          >
                            {item.label}
                          </span>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={markSetComplete}
                        className="inline-flex h-11 items-center gap-2 rounded-full bg-black px-4 text-sm font-black text-white transition hover:scale-[1.02]"
                      >
                        <Check className="h-4 w-4" />
                        มาร์กครบชุด
                      </button>
                      <button
                        type="button"
                        onClick={clearSet}
                        className="inline-flex h-11 items-center gap-2 rounded-full bg-red-50 px-4 text-sm font-black text-red-600 ring-1 ring-red-100 transition hover:bg-red-100"
                      >
                        <X className="h-4 w-4" />
                        ล้างชุดนี้
                      </button>
                      <a
                        href={NEXORA_COLLECTION_SOURCE_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-11 items-center gap-2 rounded-full bg-[#f3f1ea] px-4 text-sm font-black text-black ring-1 ring-black/5 transition hover:bg-[#ebe6da]"
                      >
                        <Sparkles className="h-4 w-4" />
                        ข้อมูลต้นทาง
                      </a>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-black">
                          <ListChecks className="h-4 w-4 text-emerald-600" />
                          มีแล้ว
                        </div>
                        <div className="max-h-[240px] overflow-auto rounded-[22px] bg-[#f3f1ea] p-3 ring-1 ring-black/5 xl:max-h-[320px]">
                          {activeStat.owned.length === 0 ? (
                            <div className="px-2 py-5 text-sm font-bold text-black/42">
                              ยังไม่มีการ์ดในชุดนี้
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {activeStat.owned.map((cardId) => (
                                <button
                                  key={cardId}
                                  type="button"
                                  onClick={() => toggleCard(cardId)}
                                  className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-black text-white"
                                >
                                  #{formatCardNo(cardId)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-black">
                          <Gem className="h-4 w-4 text-[#a96d00]" />
                          ขาดอยู่
                        </div>
                        <div className="max-h-[240px] overflow-auto rounded-[22px] bg-[#f3f1ea] p-3 ring-1 ring-black/5 xl:max-h-[320px]">
                          {activeStat.missing.length === 0 ? (
                            <div className="px-2 py-5 text-sm font-black text-emerald-700">
                              ครบชุดแล้ว
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {activeStat.missing.map((cardId) => (
                                <button
                                  key={cardId}
                                  type="button"
                                  onClick={() => toggleCard(cardId)}
                                  className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-black ring-1 ring-black/8 transition hover:bg-black hover:text-white"
                                >
                                  #{formatCardNo(cardId)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[22px] bg-[#f3f1ea] px-4 py-4 text-xs font-bold leading-5 text-black/48">
                      ติดตามเลขการ์ดทั้งหมด {totalTrackedCards.toLocaleString("th-TH")} เลข จากข้อมูลชุดสะสม 19 ชุดของ NEXORA
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
