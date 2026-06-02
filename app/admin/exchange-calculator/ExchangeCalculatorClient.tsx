"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  Calculator,
  Coins,
  Gift,
  PackagePlus,
  RotateCcw,
  Sparkles,
  Trash2,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  getCollectionCardIds,
  nexoraCollectionSets,
  type NexoraCollectionSet,
} from "@/lib/nexora-collection-sets";
import {
  getNexoraCoinReward,
  getNexoraSingleCardNexReward,
} from "@/lib/nexora-card-rewards";

type CoinCard = {
  id: string;
  cardNo: string;
  cardName: string;
  imageUrl: string;
  coinValue: number;
  quantity: number;
};

type SetItem = {
  id: string;
  setId: string;
  order: number;
  setName: string;
  quantity: number;
  nexValue: number;
  reward: string;
  withFoilBonus: boolean;
  cardTotal: number;
};

type CardPreview = {
  cardNo: string;
  cardName: string;
  imageUrl: string;
  coinValue: number;
  singleCardNexValue: number;
  rawReward: string;
};

type SingleCardNexItem = {
  id: string;
  cardNo: string;
  cardName: string;
  imageUrl: string;
  nexValue: number;
  quantity: number;
};

const emptyNexInputs = {
  bronze: "",
  silver: "",
  gold: "",
};

function normalizeCardNo(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(3, "0").slice(-3);
}

function toNumber(value: string) {
  const normalized = String(value || "").replace(/[−–—]/g, "-").replace(/,/g, "");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toCount(value: string) {
  return Math.max(0, Math.floor(toNumber(value)));
}

function formatNumber(value: number, fractionDigits = 0) {
  return Number(value || 0).toLocaleString("th-TH", {
    maximumFractionDigits: fractionDigits,
  });
}

function formatMoney(value: number) {
  return `${formatNumber(value, 2)} บาท`;
}

function parseNexReward(reward: string, withFoilBonus: boolean) {
  const amounts = Array.from(reward.matchAll(/([\d,]+)\s*Nex/gi))
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (amounts.length === 0) return 0;
  return withFoilBonus ? Math.max(...amounts) : amounts[0];
}

function hasFoilBonusOption(set: NexoraCollectionSet) {
  const text = `${set.reward} ${set.story}`.toLowerCase();
  return /foil|ฟอยล์/.test(text);
}

function getSetConditionText(set: NexoraCollectionSet) {
  if (!hasFoilBonusOption(set)) return "";
  const parts = set.reward.split(";").map((part) => part.trim()).filter(Boolean);
  return parts.find((part) => /foil|ฟอยล์/i.test(part)) || set.story;
}

function parseCoinValue(source: Record<string, unknown>) {
  const directFields = [
    "coin",
    "coins",
    "coinValue",
    "coin_value",
    "coinReward",
    "coin_reward",
    "coinCost",
    "coin_cost",
  ];

  for (const field of directFields) {
    const numeric = toNumber(String(source[field] || ""));
    if (numeric > 0) return numeric;
  }

  const textFields = [
    source.reward,
    source.rewardText,
    source.description,
    source.value,
    source.rarity,
    source.note,
    source.rawText,
  ]
    .map((value) => String(value || ""))
    .join(" ");
  const coinMatch = textFields.match(/([\d,]+)\s*(?:COIN|Coin|coin|เหรียญ)/);
  const thaiCoinMatch = textFields.match(/(?:COIN|Coin|coin|เหรียญ)\s*([\d,]+)/);

  return toNumber(coinMatch?.[1] || thaiCoinMatch?.[1] || "");
}

function parseSingleCardNexValue(source: Record<string, unknown>, cardNo: string) {
  const directFields = [
    "singleCardNexValue",
    "single_card_nex_value",
    "nexValue",
    "nex_value",
    "jackpotNex",
    "jackpot_nex",
  ];

  for (const field of directFields) {
    const numeric = toNumber(String(source[field] || ""));
    if (numeric > 0) return numeric;
  }

  return getNexoraSingleCardNexReward(cardNo)?.nexValue || 0;
}

function resolveCardPreview(data: Record<string, unknown>, fallbackCardNo: string): CardPreview {
  const nested =
    (data.card as Record<string, unknown> | undefined) ||
    (data.result as Record<string, unknown> | undefined) ||
    data;
  const cardNo = normalizeCardNo(
    String(
      nested.cardNo ||
        nested.card_no ||
        nested.no ||
        nested.number ||
        fallbackCardNo
    )
  );
  const imageUrl = String(
    nested.imageUrl ||
      nested.image_url ||
      nested.image ||
      nested.cardImage ||
      `/cards/${cardNo}.jpg`
  );
  const rawReward = String(
    nested.reward || nested.rewardText || nested.value || nested.rarity || ""
  ).trim();

  const canonicalCoin = getNexoraCoinReward(cardNo)?.coinValue || 0;

  return {
    cardNo,
    cardName: String(
      nested.cardName ||
        nested.card_name ||
        nested.name ||
        nested.title ||
        `NEXORA Card No.${cardNo}`
    ),
    imageUrl,
    coinValue: canonicalCoin || parseCoinValue(nested),
    singleCardNexValue: parseSingleCardNexValue(nested, cardNo),
    rawReward,
  };
}

export default function ExchangeCalculatorClient() {
  const [nexInputs, setNexInputs] = useState(emptyNexInputs);
  const [cardQuery, setCardQuery] = useState("");
  const [cardQuantity, setCardQuantity] = useState("1");
  const [cardPreview, setCardPreview] = useState<CardPreview | null>(null);
  const [coinItems, setCoinItems] = useState<CoinCard[]>([]);
  const [singleCardQuery, setSingleCardQuery] = useState("");
  const [singleCardPreview, setSingleCardPreview] = useState<CardPreview | null>(null);
  const [singleCardItems, setSingleCardItems] = useState<SingleCardNexItem[]>([]);
  const [pendingSingleCard, setPendingSingleCard] = useState<CardPreview | null>(null);
  const [singleCardQuantity, setSingleCardQuantity] = useState("1");
  const [quantityBySet, setQuantityBySet] = useState<Record<string, string>>({});
  const [foilBonusBySet, setFoilBonusBySet] = useState<Record<string, boolean>>({});
  const [setItems, setSetItems] = useState<SetItem[]>([]);
  const [setPickerOpen, setSetPickerOpen] = useState(false);
  const [rewardName, setRewardName] = useState("");
  const [rewardValue, setRewardValue] = useState("");

  const nexTotal =
    toCount(nexInputs.bronze) * 0.5 +
    toCount(nexInputs.silver) * 1 +
    toCount(nexInputs.gold) * 2;
  const totalCoin = coinItems.reduce(
    (sum, item) => sum + item.coinValue * item.quantity,
    0
  );
  const totalSingleCardNex = singleCardItems.reduce(
    (sum, item) => sum + item.nexValue * item.quantity,
    0
  );
  const totalSetNex = setItems.reduce(
    (sum, item) => sum + item.nexValue * item.quantity,
    0
  );
  const rewardNumericValue = Math.max(0, toNumber(rewardValue));
  const rewardNexCost = rewardNumericValue * 1.1;
  const withholdingTax = rewardNumericValue * 0.05;
  const companyBuybackDiscount = rewardNumericValue * 0.2;
  const cashBuyback = rewardNumericValue * 0.8;
  const allSets = useMemo(
    () => [...nexoraCollectionSets].sort((a, b) => a.order - b.order),
    []
  );

  useEffect(() => {
    const cardNo = normalizeCardNo(cardQuery);
    if (!cardNo) {
      setCardPreview(null);
      return;
    }

    const localPreview: CardPreview = {
      cardNo,
      cardName: `NEXORA Card No.${cardNo}`,
      imageUrl: `/cards/${cardNo}.jpg`,
      coinValue: getNexoraCoinReward(cardNo)?.coinValue || 0,
      singleCardNexValue: getNexoraSingleCardNexReward(cardNo)?.nexValue || 0,
      rawReward: "",
    };
    setCardPreview(localPreview);

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/card?cardNo=${encodeURIComponent(cardNo)}`, {
          cache: "no-store",
        });
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok || data.error) return;
        setCardPreview(resolveCardPreview(data, cardNo));
      } catch {
        setCardPreview(localPreview);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [cardQuery]);

  useEffect(() => {
    const cardNo = normalizeCardNo(singleCardQuery);
    if (!cardNo) {
      setSingleCardPreview(null);
      return;
    }

    const reward = getNexoraSingleCardNexReward(cardNo);
    const localPreview: CardPreview = {
      cardNo,
      cardName: `NEXORA Card No.${cardNo}`,
      imageUrl: `/cards/${cardNo}.jpg`,
      coinValue: getNexoraCoinReward(cardNo)?.coinValue || 0,
      singleCardNexValue: reward?.nexValue || 0,
      rawReward: reward ? `${formatNumber(reward.nexValue)} NEX` : "",
    };
    setSingleCardPreview(localPreview);

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/card?cardNo=${encodeURIComponent(cardNo)}`, {
          cache: "no-store",
        });
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok || data.error) return;
        setSingleCardPreview(resolveCardPreview(data, cardNo));
      } catch {
        setSingleCardPreview(localPreview);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [singleCardQuery]);

  useEffect(() => {
    if (!setPickerOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSetPickerOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setPickerOpen]);

  const updateNexInput = (key: keyof typeof emptyNexInputs, value: string) => {
    setNexInputs((current) => ({ ...current, [key]: value }));
  };

  const addCoinCard = () => {
    const cardNo = cardPreview?.cardNo || normalizeCardNo(cardQuery);
    const quantity = Math.max(1, toCount(cardQuantity || "1"));
    if (!cardNo || quantity <= 0) return;

    const preview =
      cardPreview ||
      ({
        cardNo,
        cardName: `NEXORA Card No.${cardNo}`,
        imageUrl: `/cards/${cardNo}.jpg`,
        coinValue: getNexoraCoinReward(cardNo)?.coinValue || 0,
        singleCardNexValue: getNexoraSingleCardNexReward(cardNo)?.nexValue || 0,
        rawReward: "",
      } satisfies CardPreview);

    setCoinItems((current) => [
      ...current,
      {
        id: `${cardNo}-${Date.now()}`,
        cardNo,
        cardName: preview.cardName,
        imageUrl: preview.imageUrl,
        coinValue: preview.coinValue,
        quantity,
      },
    ]);
    setCardQuery("");
    setCardQuantity("1");
    setCardPreview(null);
  };

  const requestAddSingleCard = () => {
    const cardNo = singleCardPreview?.cardNo || normalizeCardNo(singleCardQuery);
    if (!cardNo) return;

    const reward = getNexoraSingleCardNexReward(cardNo);
    if (!reward) return;

    const preview =
      singleCardPreview ||
      ({
        cardNo,
        cardName: `NEXORA Card No.${cardNo}`,
        imageUrl: `/cards/${cardNo}.jpg`,
        coinValue: getNexoraCoinReward(cardNo)?.coinValue || 0,
        singleCardNexValue: reward.nexValue,
        rawReward: `${formatNumber(reward.nexValue)} NEX`,
      } satisfies CardPreview);

    setPendingSingleCard({
      ...preview,
      singleCardNexValue: reward.nexValue,
    });
    setSingleCardQuantity("1");
  };

  const confirmAddSingleCard = () => {
    if (!pendingSingleCard || pendingSingleCard.singleCardNexValue <= 0) return;
    const quantity = Math.max(1, toCount(singleCardQuantity || "1"));

    setSingleCardItems((current) => [
      ...current,
      {
        id: `${pendingSingleCard.cardNo}-${Date.now()}`,
        cardNo: pendingSingleCard.cardNo,
        cardName: pendingSingleCard.cardName,
        imageUrl: pendingSingleCard.imageUrl,
        nexValue: pendingSingleCard.singleCardNexValue,
        quantity,
      },
    ]);
    setPendingSingleCard(null);
    setSingleCardQuery("");
    setSingleCardPreview(null);
    setSingleCardQuantity("1");
  };

  const addSetItem = (
    set: NexoraCollectionSet,
    quantity: number,
    withFoilBonus: boolean
  ) => {
    const safeQuantity = Math.max(1, Math.floor(quantity));
    if (!Number.isFinite(safeQuantity) || safeQuantity <= 0) return;

    setSetItems((current) => [
      ...current,
      {
        id: `${set.id}-${withFoilBonus ? "foil" : "base"}-${Date.now()}`,
        setId: set.id,
        order: set.order,
        setName: set.name,
        quantity: safeQuantity,
        nexValue: parseNexReward(set.reward, withFoilBonus),
        reward: set.reward,
        withFoilBonus,
        cardTotal: set.officialTotal || getCollectionCardIds(set).length,
      },
    ]);
  };

  return (
    <div className="space-y-5 text-white">
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white text-black shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="bg-black p-5 text-white sm:p-7 xl:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/55">
              <Calculator className="h-4 w-4" />
              Admin Exchange Calculator
            </div>
            <h1 className="mt-5 text-4xl font-black leading-none sm:text-5xl">
              คำนวณการแลก
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-bold leading-7 text-white/58">
              รวมเครื่องมือคำนวณ NEX, COIN, เซ็ตสะสม และรับซื้อคืนของรางวัลไว้หน้าเดียว
              สำหรับใช้หน้าเคาน์เตอร์แบบเร็วและตรวจซ้ำง่าย
            </p>
          </div>
          <div className="grid gap-3 bg-[#f6f6f3] p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-1 xl:grid-cols-2">
            <HeroMetric label="NEX จากการ์ด" value={formatNumber(nexTotal, 1)} unit="NEX" />
            <HeroMetric label="COIN จากเลขการ์ด" value={formatNumber(totalCoin)} unit="COIN" />
            <HeroMetric label="NEX รางวัลใบเดียว" value={formatNumber(totalSingleCardNex)} unit="NEX" />
            <HeroMetric label="NEX จากเซ็ต" value={formatNumber(totalSetNex)} unit="NEX" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <PanelHeader icon={Sparkles} kicker="NEX Zone" title="คำนวณ NEX จากระดับการ์ด" />
          <div className="mt-4 grid gap-3">
            {[
              { key: "bronze" as const, label: "การ์ดบรอนซ์", rate: "0.5 NEX / ใบ" },
              { key: "silver" as const, label: "การ์ดซิลเวอร์", rate: "1 NEX / ใบ" },
              { key: "gold" as const, label: "การ์ดโกลด์", rate: "2 NEX / ใบ" },
            ].map((item) => (
              <label
                key={item.key}
                className="grid gap-3 rounded-[22px] border border-white/10 bg-black/30 p-3 sm:grid-cols-[1fr_150px] sm:items-center"
              >
                <span>
                  <span className="block text-base font-black text-white">{item.label}</span>
                  <span className="mt-1 block text-xs font-bold text-white/42">{item.rate}</span>
                </span>
                <input
                  value={nexInputs[item.key]}
                  onChange={(event) => updateNexInput(item.key, event.target.value)}
                  inputMode="numeric"
                  placeholder="0"
                  className="h-12 rounded-[16px] border border-white/10 bg-white px-3 text-right text-xl font-black text-black outline-none focus:ring-2 focus:ring-white/30"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 rounded-[24px] bg-white p-4 text-black">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-black/40">
              Total NEX
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="text-4xl font-black">{formatNumber(nexTotal, 1)}</div>
              <div className="pb-1 text-lg font-black">NEX</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNexInputs(emptyNexInputs)}
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-[16px] border border-white/12 bg-white/[0.06] px-4 text-sm font-black text-white"
          >
            <RotateCcw className="h-4 w-4" />
            ล้าง NEX
          </button>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <PanelHeader icon={Coins} kicker="COIN Zone" title="คำนวณ COIN จากหมายเลขการ์ด" />
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_auto]">
            <input
              value={cardQuery}
              onChange={(event) => setCardQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCoinCard();
                }
              }}
              placeholder="กรอกเลขการ์ด เช่น 006, 200, No.293"
              inputMode="numeric"
              className="h-14 rounded-[18px] border border-white/10 bg-black/35 px-4 text-base font-black text-white outline-none placeholder:text-white/30 focus:border-white/30"
            />
            <input
              value={cardQuantity}
              onChange={(event) => setCardQuantity(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCoinCard();
                }
              }}
              placeholder="จำนวน"
              inputMode="numeric"
              className="h-14 rounded-[18px] border border-white/10 bg-black/35 px-4 text-center text-base font-black text-white outline-none placeholder:text-white/30 focus:border-white/30"
            />
            <button
              type="button"
              onClick={addCoinCard}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-[18px] bg-white px-5 text-sm font-black text-black transition hover:bg-zinc-200"
            >
              <PackagePlus className="h-4 w-4" />
              ยืนยัน
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
            <CardPreviewPanel preview={cardPreview} />
            <div className="rounded-[22px] border border-white/10 bg-black/24 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-black text-white/72">รายการ COIN</div>
                <button
                  type="button"
                  onClick={() => setCoinItems([])}
                  className="inline-flex h-9 items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.06] px-3 text-xs font-black text-white/70"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  ล้าง
                </button>
              </div>
              <div className="mt-3 grid max-h-[320px] gap-2 overflow-y-auto pr-1">
                {coinItems.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-white/12 bg-white/[0.025] p-4 text-sm font-bold text-white/40">
                    ยังไม่มีรายการ กรอกเลขการ์ดและจำนวนแล้วกด Enter ได้เลย
                  </div>
                ) : (
                  coinItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-[48px_minmax(0,1fr)_auto] gap-3 rounded-[18px] border border-white/8 bg-white/[0.04] p-2">
                      <img
                        src={item.imageUrl}
                        alt={item.cardName}
                        loading="lazy"
                        className="h-16 w-11 rounded-[10px] object-cover"
                        onError={(event) => {
                          event.currentTarget.src = `/cards/${item.cardNo}.jpg`;
                        }}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-white">
                          No.{item.cardNo} {item.cardName}
                        </div>
                        <div className="mt-1 text-xs font-bold text-white/45">
                          {formatNumber(item.coinValue)} COIN x {formatNumber(item.quantity)} ใบ
                        </div>
                        <div className="mt-1 text-sm font-black text-white">
                          {formatNumber(item.coinValue * item.quantity)} COIN
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setCoinItems((current) => current.filter((row) => row.id !== item.id))
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-red-300/20 bg-red-500/10 text-red-100"
                        aria-label="ลบรายการ"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 rounded-[20px] bg-white p-4 text-black">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-black/40">
                  Total Coin
                </div>
                <div className="mt-1 text-3xl font-black">{formatNumber(totalCoin)} COIN</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
        <PanelHeader icon={BadgePercent} kicker="Single Card Reward" title="รางวัลใบเดียว NEX" />
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                value={singleCardQuery}
                onChange={(event) => setSingleCardQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    requestAddSingleCard();
                  }
                }}
                placeholder="กรอกเลขการ์ดรางวัลใบเดียว เช่น 009, 170"
                inputMode="numeric"
                className="h-14 rounded-[18px] border border-white/10 bg-black/35 px-4 text-base font-black text-white outline-none placeholder:text-white/30 focus:border-white/30"
              />
              <button
                type="button"
                onClick={requestAddSingleCard}
                disabled={!singleCardPreview?.singleCardNexValue}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-[18px] bg-white px-5 text-sm font-black text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/35"
              >
                <PackagePlus className="h-4 w-4" />
                ยืนยัน
              </button>
            </div>
            <SingleCardPreviewPanel preview={singleCardPreview} />
          </div>

          <div className="rounded-[22px] border border-white/10 bg-black/24 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-black text-white/72">รายการรางวัลใบเดียว</div>
              <button
                type="button"
                onClick={() => setSingleCardItems([])}
                className="inline-flex h-9 items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.06] px-3 text-xs font-black text-white/70"
              >
                <Trash2 className="h-3.5 w-3.5" />
                ล้าง
              </button>
            </div>
            <div className="mt-3 grid max-h-[320px] gap-2 overflow-y-auto pr-1">
              {singleCardItems.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-white/12 bg-white/[0.025] p-4 text-sm font-bold text-white/40">
                  ยังไม่มีรายการ ใส่เลขการ์ดที่มีรางวัลใบเดียว แล้วกด Enter หรือยืนยัน
                </div>
              ) : (
                singleCardItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-[48px_minmax(0,1fr)_auto] gap-3 rounded-[18px] border border-white/8 bg-white/[0.04] p-2">
                    <img
                      src={item.imageUrl}
                      alt={item.cardName}
                      loading="lazy"
                      className="h-16 w-11 rounded-[10px] object-cover"
                      onError={(event) => {
                        event.currentTarget.src = `/cards/${item.cardNo}.jpg`;
                      }}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-white">
                        No.{item.cardNo} {item.cardName}
                      </div>
                      <div className="mt-1 text-xs font-bold text-white/45">
                        {formatNumber(item.nexValue)} NEX x {formatNumber(item.quantity)} ใบ
                      </div>
                      <div className="mt-1 text-sm font-black text-white">
                        {formatNumber(item.nexValue * item.quantity)} NEX
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSingleCardItems((current) => current.filter((row) => row.id !== item.id))
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-red-300/20 bg-red-500/10 text-red-100"
                      aria-label="ลบรางวัลใบเดียว"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 rounded-[20px] bg-white p-4 text-black">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-black/40">
                Total Single Card NEX
              </div>
              <div className="mt-1 text-3xl font-black">{formatNumber(totalSingleCardNex)} NEX</div>
            </div>
          </div>
        </div>
      </section>

      {pendingSingleCard ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/76 p-4 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="single-card-quantity-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => setPendingSingleCard(null)}
            aria-label="ปิดหน้าต่างจำนวน"
          />
          <div className="relative w-full max-w-md rounded-[26px] border border-white/10 bg-[#111113] p-5 text-white shadow-[0_30px_110px_rgba(0,0,0,0.65)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
                  Quantity
                </div>
                <h3 id="single-card-quantity-title" className="mt-1 text-2xl font-black">
                  จำนวนการ์ดใบนี้
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingSingleCard(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.06] text-white"
                aria-label="ปิดหน้าต่างจำนวน"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-[20px] border border-white/10 bg-black/30 p-3">
              <img
                src={pendingSingleCard.imageUrl}
                alt={pendingSingleCard.cardName}
                className="h-24 w-16 rounded-[12px] object-cover"
              />
              <div className="min-w-0">
                <div className="truncate text-base font-black">
                  No.{pendingSingleCard.cardNo} {pendingSingleCard.cardName}
                </div>
                <div className="mt-2 text-sm font-bold text-white/52">
                  {formatNumber(pendingSingleCard.singleCardNexValue)} NEX / ใบ
                </div>
              </div>
            </div>
            <input
              value={singleCardQuantity}
              onChange={(event) => setSingleCardQuantity(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  confirmAddSingleCard();
                }
              }}
              inputMode="numeric"
              className="mt-4 h-14 w-full rounded-[18px] border border-white/10 bg-black/40 px-4 text-center text-xl font-black text-white outline-none focus:border-white/35"
            />
            <button
              type="button"
              onClick={confirmAddSingleCard}
              className="mt-3 inline-flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-white px-5 text-sm font-black text-black transition hover:bg-zinc-200"
            >
              <PackagePlus className="h-4 w-4" />
              เพิ่มเข้าคำนวณ
            </button>
          </div>
        </div>
      ) : null}

      {setPickerOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/78 p-3 backdrop-blur-xl sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="collection-set-picker-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => setSetPickerOpen(false)}
            aria-label="ปิดหน้าต่างเลือกเซ็ต"
          />
          <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#111113] shadow-[0_30px_110px_rgba(0,0,0,0.65)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/8 p-4 sm:p-5">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">
                  Collection Sets
                </div>
                <h3 id="collection-set-picker-title" className="mt-1 text-2xl font-black text-white">
                  เลือกเซ็ตการ์ด 40 เซ็ต
                </h3>
                <p className="mt-2 text-sm font-bold leading-6 text-white/52">
                  ระบุจำนวนเซ็ตข้างปุ่มเพิ่ม และติ๊กเงื่อนไขฟอยล์เมื่อเซ็ตนั้นมีเงื่อนไขพิเศษ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSetPickerOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.06] text-white transition hover:bg-white/[0.12]"
                aria-label="ปิดหน้าต่างเลือกเซ็ต"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 overflow-y-auto p-4 sm:p-5 xl:grid-cols-2">
              {allSets.map((set) => {
                const quantityValue = quantityBySet[set.id] ?? "1";
                const withFoilBonus = Boolean(foilBonusBySet[set.id]);
                const baseValue = parseNexReward(set.reward, false);
                const activeValue = parseNexReward(set.reward, withFoilBonus);
                const conditionText = getSetConditionText(set);
                const cardTotal = set.officialTotal || getCollectionCardIds(set).length;

                return (
                  <div key={set.id} className="rounded-[22px] border border-white/10 bg-black/28 p-3 sm:p-4">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_176px] lg:items-center">
                      <div className="min-w-0">
                        <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2">
                          <span className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.08] text-sm font-black text-white">
                            {set.order}
                          </span>
                          <div className="min-w-0 break-words text-base font-black leading-6 text-white">
                            {set.name}
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/[0.055] px-2.5 py-1 text-[11px] font-black text-white/52">
                            {cardTotal} ใบ
                          </span>
                        </div>
                        <div className="mt-3 line-clamp-2 text-sm leading-6 text-white/52">
                          {set.reward}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-black">
                          <span className="rounded-full border border-emerald-200/15 bg-emerald-400/15 px-3 py-1 text-emerald-50">
                            {baseValue > 0 ? `${formatNumber(baseValue)} NEX` : "รางวัลพิเศษ"}
                          </span>
                          {withFoilBonus && activeValue !== baseValue ? (
                            <span className="rounded-full border border-white/16 bg-white/[0.12] px-3 py-1 text-white">
                              เพิ่มเป็น {formatNumber(activeValue)} NEX
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-[minmax(82px,1fr)_96px] gap-2">
                        <input
                          value={quantityValue}
                          onChange={(event) =>
                            setQuantityBySet((current) => ({
                              ...current,
                              [set.id]: event.target.value,
                            }))
                          }
                          inputMode="numeric"
                          aria-label={`จำนวนเซ็ต ${set.order}`}
                          className="h-12 min-w-0 rounded-[16px] border border-white/10 bg-black/55 px-3 text-center text-base font-black text-white outline-none focus:border-white/35"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            addSetItem(set, Number(quantityValue || 1), withFoilBonus)
                          }
                          className="inline-flex h-12 min-w-0 items-center justify-center gap-2 rounded-[16px] bg-white px-3 text-sm font-black text-black transition hover:bg-zinc-200"
                        >
                          <PackagePlus className="h-4 w-4" />
                          เพิ่ม
                        </button>
                      </div>
                    </div>

                    {conditionText ? (
                      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-[18px] border border-white/10 bg-white/[0.055] p-3 text-sm leading-6 text-white/82">
                        <input
                          type="checkbox"
                          checked={withFoilBonus}
                          onChange={(event) =>
                            setFoilBonusBySet((current) => ({
                              ...current,
                              [set.id]: event.target.checked,
                            }))
                          }
                          className="mt-1 h-4 w-4 shrink-0 accent-white"
                        />
                        <span className="min-w-0">ใช้เงื่อนไขฟอยล์เพิ่ม: {conditionText}</span>
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-white/8 bg-[#111113]/95 p-3 sm:p-4">
              <button
                type="button"
                onClick={() => setSetPickerOpen(false)}
                className="flex h-12 w-full items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.06] text-sm font-black text-white transition hover:bg-white/[0.12]"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
        <PanelHeader icon={Trophy} kicker="Collection Sets" title="คำนวณเซ็ตสะสม 40 เซ็ต" />
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <button
            type="button"
            onClick={() => setSetPickerOpen(true)}
            className="group flex min-h-[210px] flex-col justify-between rounded-[24px] border border-white/10 bg-black/28 p-4 text-left transition hover:border-white/22 hover:bg-white/[0.055] sm:p-5"
          >
            <span>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-[18px] bg-white text-black transition group-hover:bg-zinc-200">
                <PackagePlus className="h-5 w-5" />
              </span>
              <span className="mt-5 block text-2xl font-black text-white">
                เพิ่มเซ็ตสะสม
              </span>
              <span className="mt-2 block max-w-2xl text-sm font-bold leading-7 text-white/52">
                เปิดหน้าต่างเลือกเซ็ตทั้งหมด 40 เซ็ต ใส่จำนวน และเลือกเงื่อนไขฟอยล์ได้ในที่เดียว
              </span>
            </span>
            <span className="mt-6 inline-flex h-12 w-fit items-center gap-2 rounded-[16px] bg-white px-5 text-sm font-black text-black transition group-hover:bg-zinc-200">
              <PackagePlus className="h-4 w-4" />
              เลือกเซ็ต
            </span>
          </button>
          <div className="rounded-[24px] border border-white/10 bg-black/28 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
                  Selected Sets
                </div>
                <div className="mt-1 text-2xl font-black text-white">
                  {formatNumber(totalSetNex)} NEX
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSetItems([])}
                className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.06] px-3 text-xs font-black text-white/70"
              >
                <Trash2 className="h-3.5 w-3.5" />
                ล้าง
              </button>
            </div>
            <div className="mt-4 grid max-h-[540px] gap-2 overflow-y-auto pr-1">
              {setItems.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-white/12 bg-white/[0.025] p-4 text-sm font-bold text-white/40">
                  เลือกเซ็ตแล้วรายการจะทบรวม NEX ไว้ตรงนี้
                </div>
              ) : (
                setItems.map((item) => (
                  <div key={item.id} className="rounded-[18px] border border-white/8 bg-white/[0.04] p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 min-w-10 items-center justify-center rounded-[14px] bg-white text-sm font-black text-black">
                        {item.order}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-white">{item.setName}</div>
                        <div className="mt-1 text-xs font-bold text-white/45">
                          {formatNumber(item.nexValue)} NEX x {formatNumber(item.quantity)} เซ็ต
                        </div>
                        <div className="mt-1 text-sm font-black text-white">
                          {formatNumber(item.nexValue * item.quantity)} NEX
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSetItems((current) => current.filter((row) => row.id !== item.id))
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-red-300/20 bg-red-500/10 text-red-100"
                        aria-label="ลบเซ็ต"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {item.withFoilBonus ? (
                      <div className="mt-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-black text-white/64">
                        รวมเงื่อนไขฟอยล์
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
        <PanelHeader icon={Gift} kicker="Reward Buyback" title="คำนวณของรางวัลและรับซื้อคืน" />
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="grid gap-3">
            <label className="grid gap-2">
              <span className="text-sm font-black text-white/72">ชื่อรางวัล / ยี่ห้อ / รุ่น</span>
              <textarea
                value={rewardName}
                onChange={(event) => setRewardName(event.target.value)}
                placeholder="เช่น iPhone 17 Pro Max 256GB สีดำ, PlayStation 5 Slim Disc Edition"
                className="min-h-28 rounded-[22px] border border-white/10 bg-black/35 px-4 py-3 text-base font-bold text-white outline-none placeholder:text-white/30 focus:border-white/30"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-black text-white/72">มูลค่าสินค้าจริง</span>
              <input
                value={rewardValue}
                onChange={(event) => setRewardValue(event.target.value)}
                inputMode="decimal"
                placeholder="เช่น 45900"
                className="h-14 rounded-[20px] border border-white/10 bg-black/35 px-4 text-xl font-black text-white outline-none placeholder:text-white/30 focus:border-white/30"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ResultTile
              label="ใช้ NEX แลก"
              value={`${formatNumber(rewardNexCost, 2)} NEX`}
              detail="บวกเพิ่ม 10% จากมูลค่าสินค้าจริง"
            />
            <ResultTile
              label="หัก ณ ที่จ่าย 5%"
              value={formatMoney(withholdingTax)}
              detail="คำนวณจากมูลค่าของรางวัล"
            />
            <ResultTile
              label="บริษัทรับซื้อคืนหัก 20%"
              value={formatMoney(companyBuybackDiscount)}
              detail="ส่วนต่างที่ถูกหักจากมูลค่ารางวัล"
            />
            <ResultTile
              label="ลูกค้ารับเป็นเงินสด"
              value={formatMoney(cashBuyback)}
              detail="กรณีไม่รับของจริงในวันแลก"
              strong
            />
          </div>
        </div>
        <div className="mt-4 rounded-[22px] border border-white/10 bg-black/30 p-4 text-sm font-bold leading-7 text-white/52">
          {rewardName.trim() ? rewardName.trim() : "ยังไม่ได้ระบุชื่อรางวัล"} • มูลค่าจริง{" "}
          {formatMoney(rewardNumericValue)} • NEX แลก {formatNumber(rewardNexCost, 2)} NEX
        </div>
      </section>
    </div>
  );
}

function HeroMetric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-[24px] border border-black/5 bg-white p-4 text-black shadow-[0_16px_36px_rgba(0,0,0,0.06)]">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-black/38">
        {label}
      </div>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <div className="mt-1 text-xs font-black text-black/45">{unit}</div>
    </div>
  );
}

function PanelHeader({
  icon: Icon,
  kicker,
  title,
}: {
  icon: LucideIcon;
  kicker: string;
  title: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">
          {kicker}
        </div>
        <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">{title}</h2>
      </div>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.06] text-white">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function CardPreviewPanel({ preview }: { preview: CardPreview | null }) {
  if (!preview) {
    return (
      <div className="grid min-h-[250px] place-items-center rounded-[22px] border border-dashed border-white/12 bg-black/24 p-4 text-center text-sm font-bold text-white/40">
        รูปการ์ดจะขึ้นทันทีหลังกรอกหมายเลข
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border border-white/10 bg-black/24 p-3">
      <img
        src={preview.imageUrl}
        alt={preview.cardName}
        className="mx-auto aspect-[5/7] max-h-[260px] w-full rounded-[18px] object-cover"
        onError={(event) => {
          event.currentTarget.src = `/cards/${preview.cardNo}.jpg`;
        }}
      />
      <div className="mt-3 text-sm font-black text-white">
        No.{preview.cardNo} {preview.cardName}
      </div>
      <div className="mt-1 text-xs font-bold text-white/45">
        {preview.rawReward || "ไม่มีข้อความรางวัลจาก API"}
      </div>
      <div className="mt-3 rounded-[16px] bg-white px-3 py-2 text-center text-lg font-black text-black">
        {formatNumber(preview.coinValue)} COIN / ใบ
      </div>
    </div>
  );
}

function SingleCardPreviewPanel({ preview }: { preview: CardPreview | null }) {
  if (!preview) {
    return (
      <div className="grid min-h-[220px] place-items-center rounded-[22px] border border-dashed border-white/12 bg-black/24 p-4 text-center text-sm font-bold text-white/40">
        รูปและมูลค่า NEX จะขึ้นทันทีหลังกรอกเลขการ์ดรางวัลใบเดียว
      </div>
    );
  }

  const hasReward = preview.singleCardNexValue > 0;

  return (
    <div className={`grid gap-4 rounded-[22px] border p-3 sm:grid-cols-[150px_minmax(0,1fr)] ${hasReward ? "border-emerald-200/20 bg-emerald-400/10" : "border-white/10 bg-black/24"}`}>
      <img
        src={preview.imageUrl}
        alt={preview.cardName}
        className="mx-auto aspect-[5/7] max-h-[220px] w-full max-w-[150px] rounded-[18px] object-cover"
        onError={(event) => {
          event.currentTarget.src = `/cards/${preview.cardNo}.jpg`;
        }}
      />
      <div className="min-w-0 self-center">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
          Card Preview
        </div>
        <div className="mt-2 break-words text-xl font-black text-white">
          No.{preview.cardNo} {preview.cardName}
        </div>
        <div className={`mt-4 rounded-[18px] px-4 py-3 text-2xl font-black ${hasReward ? "bg-white text-black" : "border border-white/10 bg-white/[0.05] text-white/45"}`}>
          {hasReward ? `${formatNumber(preview.singleCardNexValue)} NEX / ใบ` : "ไม่มีรางวัลใบเดียว"}
        </div>
      </div>
    </div>
  );
}

function ResultTile({
  label,
  value,
  detail,
  strong = false,
}: {
  label: string;
  value: string;
  detail: string;
  strong?: boolean;
}) {
  return (
    <div className={`rounded-[22px] border p-4 ${strong ? "border-white bg-white text-black" : "border-white/10 bg-black/30 text-white"}`}>
      <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${strong ? "text-black/45" : "text-white/38"}`}>
        <BadgePercent className="mb-3 h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 break-words text-2xl font-black">{value}</div>
      <div className={`mt-2 text-xs font-bold leading-5 ${strong ? "text-black/50" : "text-white/45"}`}>
        {detail}
      </div>
    </div>
  );
}
