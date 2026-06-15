"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  BadgeCheck,
  Check,
  CircleDollarSign,
  Layers3,
  Landmark,
  Loader2,
  PackagePlus,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import {
  canChooseCardFinish,
  isForcedFoilCard,
} from "@/lib/card-finish";
import {
  getCollectionCardIds,
  nexoraCollectionSets,
  type NexoraCollectionSet,
} from "@/lib/nexora-collection-sets";
import AdminUserAvatar from "@/app/admin/AdminUserAvatar";
import { useRouter } from "next/navigation";

type UserRow = {
  id: string;
  name: string | null;
  image: string | null;
  displayName: string | null;
  username: string | null;
  lineId: string;
  nexPoint: number;
  coin: number;
  createdAt: string;
};

type CardPreview = {
  cardNo: string;
  cardName: string;
  rarity?: string;
  reward?: string;
  imageUrl: string;
};

type DepositItem = {
  id: string;
  cardNo: string;
  cardName: string;
  cardType: "normal" | "foil";
  rarity?: string;
  quantity: number;
  imageUrl: string;
};

type DepositSetItem = {
  id: string;
  setId: string;
  order: number;
  setName: string;
  quantity: number;
  nexValue: number;
  fullNexValue: number;
  reward: string;
  withFoilBonus: boolean;
  cardTotal: number;
};

type EntryMode = "bank" | "pawn";
type IntakeMode = "specific" | "sets" | "bulk";
type CardType = "normal" | "foil";
type BulkCategory = "pure" | "bronze" | "silver" | "gold" | "unknown";

function normalizeSearch(value: string) {
  return value.toLowerCase().trim().replace(/^@+/, "");
}

function normalizeCardNo(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(3, "0").slice(-3);
}

function formatNumber(value: number) {
  return value.toLocaleString("th-TH");
}

function normalizeAssetTier(value?: string | null): BulkCategory | "unknown" {
  const normalized = String(value || "").trim().toLowerCase();
  if (/bronze|เธเธฃเธญเธเธเน/.test(normalized)) return "bronze";
  if (/silver|เธเธดเธฅเน€เธงเธญเธฃเน/.test(normalized)) return "silver";
  if (/gold|เนเธเธฅเธ”เน/.test(normalized)) return "gold";
  if (/pure|nex|coin|เน€เธเธตเธขเธง/.test(normalized)) return "pure";
  return "unknown";
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
  return (
    /foil/.test(text) ||
    /ฟอยล์/.test(text) ||
    /เน€เธยเน€เธเธเน€เธเธเน€เธเธ…/.test(text)
  );
}

function getSetConditionText(set: NexoraCollectionSet) {
  if (!hasFoilBonusOption(set)) return "";
  const parts = set.reward.split(";").map((part) => part.trim()).filter(Boolean);
  return parts.find((part) => /foil|ฟอยล์|เน€เธยเน€เธเธเน€เธเธเน€เธเธ…/i.test(part)) || set.story;
}

function getDisplayName(user: UserRow) {
  return user.displayName || user.name || user.username || user.lineId || "ไม่พบชื่อ";
}

function resolveApiCard(data: Record<string, unknown>, fallbackCardNo: string): CardPreview {
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

  return {
    cardNo,
    cardName: String(
      nested.cardName ||
        nested.card_name ||
        nested.name ||
        nested.title ||
        `NEXORA Card No.${cardNo}`
    ),
    rarity: String(nested.rarity || nested.value || nested.tier || "").trim() || undefined,
    reward: String(nested.reward || "").trim() || undefined,
    imageUrl,
  };
}

export default function CreateCardBankEntryClient({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null);
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("specific");
  const [cardType, setCardType] = useState<CardType>("normal");
  const [cardQuery, setCardQuery] = useState("");
  const [cardPreview, setCardPreview] = useState<CardPreview | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState("");
  const [quantityModalOpen, setQuantityModalOpen] = useState(false);
  const [setModalOpen, setSetModalOpen] = useState(false);
  const [quantityInput, setQuantityInput] = useState("1");
  const [items, setItems] = useState<DepositItem[]>([]);
  const [cardSetItems, setCardSetItems] = useState<DepositSetItem[]>([]);
  const [bulkNex, setBulkNex] = useState("");
  const [bulkCoin, setBulkCoin] = useState("");
  const [bulkCategory, setBulkCategory] = useState<BulkCategory>("pure");
  const [pawnPrincipal, setPawnPrincipal] = useState("");
  const [pawnInterestRate, setPawnInterestRate] = useState("10");
  const [pawnDueDays, setPawnDueDays] = useState("30");
  const [pawnNote, setPawnNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const filteredUsers = useMemo(() => {
    const keyword = normalizeSearch(query);
    if (!keyword) return [];

    return users
      .filter((user) => {
        const username = normalizeSearch(user.username || "");
        const fields = [
          user.name,
          user.displayName,
          user.lineId,
          user.id,
          user.username,
          username ? `@${username}` : "",
        ]
          .map((value) => normalizeSearch(String(value || "")))
          .filter(Boolean);

        return fields.some((field) => field.includes(keyword));
      })
      .slice(0, 8);
  }, [query, users]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const cardNo = normalizeCardNo(cardQuery);

    if (!cardNo) {
      setCardPreview(null);
      setCardLoading(false);
      return;
    }

    const localPreview: CardPreview = {
      cardNo,
      cardName: `NEXORA Card No.${cardNo}`,
      imageUrl: `/cards/${cardNo}.jpg`,
    };
    setCardPreview(localPreview);
    setCardLoading(true);

  const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/card?cardNo=${encodeURIComponent(cardNo)}`, {
          cache: "no-store",
        });
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

        if (!response.ok || data.error) {
          throw new Error(String(data.error || "โหลดข้อมูลการ์ดไม่สำเร็จ"));
        }

        setCardPreview(resolveApiCard(data, cardNo));
      } catch (error) {
        setCardPreview(localPreview);
        setCardError(
          error instanceof Error
            ? error.message
            : "ใช้รูปการ์ดในเครื่องแทนข้อมูลจาก API"
        );
      } finally {
        setCardLoading(false);
      }
    }, 260);

    return () => window.clearTimeout(timer);
  }, [cardQuery]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!quantityModalOpen) return;
    const timer = window.setTimeout(() => quantityInputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [quantityModalOpen]);

  const selectedUsername = String(selectedUser?.username || "").trim().replace(/^@+/, "");
  const totalSpecificCards = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalSetCount = cardSetItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalSetNex = cardSetItems.reduce(
    (sum, item) => sum + item.quantity * item.nexValue,
    0
  );
  const saveButtonLabel =
    entryMode === "pawn" ? "??????????????????????????" : "?????????????????????????";
  const saveButtonBusyLabel =
    entryMode === "pawn" ? "???????????????????????????????..." : "??????????????????????????????...";
  const summaryBadgeLabel =
    intakeMode === "specific"
      ? `${totalSpecificCards} ??`
      : intakeMode === "sets"
        ? `${formatNumber(totalSetCount)} ????`
        : "??????";
  const previewCardNo = cardPreview?.cardNo || normalizeCardNo(cardQuery);
  const forcedFoil = isForcedFoilCard(previewCardNo);

  const openQuantityModal = () => {
    if (!cardPreview) return;
    setQuantityInput("1");
    setQuantityModalOpen(true);
  };

  const confirmQuantity = () => {
    if (!cardPreview) return;
    const quantity = Math.max(1, Math.floor(Number(quantityInput || 0)));

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    const safeCardType = isForcedFoilCard(cardPreview.cardNo) ? "foil" : cardType;
    const itemId = `${cardPreview.cardNo}-${safeCardType}-${Date.now()}`;
    setItems((current) => [
      ...current,
      {
        id: itemId,
        cardNo: cardPreview.cardNo,
        cardName: cardPreview.cardName,
        cardType: safeCardType,
        rarity: cardPreview.rarity || normalizeAssetTier(cardPreview.cardName),
        quantity,
        imageUrl: cardPreview.imageUrl,
      },
    ]);
    setQuantityModalOpen(false);
    setCardQuery("");
    setCardPreview(null);
  };

  const addSetItem = (
    set: NexoraCollectionSet,
    quantity: number,
    withFoilBonus: boolean,
    receivedNexValue?: number
  ) => {
    const safeQuantity = Math.max(1, Math.floor(quantity));
    if (!Number.isFinite(safeQuantity) || safeQuantity <= 0) return;
    const baseNexValue = parseNexReward(set.reward, withFoilBonus);
    const safeReceivedNexValue = Math.max(
      1,
      Math.floor(Number(receivedNexValue || baseNexValue))
    );

    setCardSetItems((current) => [
      ...current,
      {
        id: `${set.id}-${withFoilBonus ? "foil" : "base"}-${Date.now()}`,
        setId: set.id,
        order: set.order,
        setName: set.name,
        quantity: safeQuantity,
        nexValue: safeReceivedNexValue,
        fullNexValue: baseNexValue,
        reward: set.reward,
        withFoilBonus,
        cardTotal: set.officialTotal || getCollectionCardIds(set).length,
      },
    ]);
  };

  const submitDraft = async () => {
    setSaveError("");

    if (!selectedUser || !entryMode) {
      alert("เลือกผู้ใช้และประเภทรายการก่อน");
      return;
    }

    if (intakeMode === "specific" && items.length === 0) {
      alert("เพิ่มรายการการ์ดอย่างน้อย 1 รายการก่อน");
      return;
    }

    if (intakeMode === "sets" && cardSetItems.length === 0) {
      alert("เลือกเซ็ตการ์ดอย่างน้อย 1 รายการก่อน");
      return;
    }

    if (intakeMode === "bulk" && !bulkNex.trim() && !bulkCoin.trim()) {
      alert("กรอกยอดรวม NEX หรือ COIN สำหรับระบบกองรวมก่อน");
      return;
    }

    if (entryMode === "pawn" && !pawnPrincipal.trim()) {
      alert("กรอกเงินต้นสำหรับระบบจำนำก่อน");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/card-bank/assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          owner: {
            id: selectedUser.id,
            lineId: selectedUser.lineId,
            name: getDisplayName(selectedUser),
          },
          entryMode,
          intakeMode,
          items,
          setItems: cardSetItems,
          bulk: {
            nexValue: Number(bulkNex || 0),
            coinValue: Number(bulkCoin || 0),
            category: bulkCategory,
          },
          pawn:
            entryMode === "pawn"
              ? {
                  principalTHB: Number(pawnPrincipal || 0),
                  interestRate: Number(pawnInterestRate || 10),
                  dueDays: Number(pawnDueDays || 30),
                  note: pawnNote,
                }
              : undefined,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        createdCount?: number;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "บันทึกไม่สำเร็จ");
      }

      alert(
        entryMode === "pawn"
          ? `บันทึกเข้าโรงจำนำการ์ดจริงแล้ว ${result.createdCount || 0} รายการ`
          : `บันทึกเข้าธนาคารการ์ดจริงแล้ว ${result.createdCount || 0} รายการ`
      );
      setItems([]);
      setCardSetItems([]);
      setBulkNex("");
      setBulkCoin("");
      setBulkCategory("pure");
      setPawnPrincipal("");
      setPawnInterestRate("10");
      setPawnDueDays("30");
      setPawnNote("");
      setCardQuery("");
      setCardPreview(null);
            router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "บันทึก Card Bank ไม่สำเร็จ กรุณาลองใหม่";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)]">
      <section className="space-y-4">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.055]">
              <Search className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-black">เลือกลูกค้า</h2>
              <p className="mt-2 text-sm leading-6 text-white/55">
                พิมพ์ชื่อ, @username หรือ Line ID ระบบจะแสดงผู้ใช้ทันทีโดยไม่ต้องกด Enter
              </p>
            </div>
          </div>

          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedUser(null);
              setEntryMode(null);
            }}
            placeholder="ค้นหา user เช่น @username, ชื่อ, Line ID"
            className="mt-4 h-14 w-full rounded-[20px] border border-white/10 bg-black/30 px-4 text-base font-bold text-white outline-none transition placeholder:text-white/35 focus:border-white/30 focus:ring-2 focus:ring-white/10"
          />

          <div className="mt-4 space-y-3">
            {!query.trim() ? (
              <EmptyHint text="เริ่มพิมพ์เพื่อค้นหาลูกค้า" />
            ) : filteredUsers.length === 0 ? (
              <EmptyHint text="ไม่พบลูกค้าที่ตรงกับคำค้นหา" />
            ) : (
              filteredUsers.map((user) => {
                const active = selectedUser?.id === user.id;
                const username = String(user.username || "").trim().replace(/^@+/, "");

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUser(user)}
                    className={`w-full rounded-[22px] border p-4 text-left transition ${
                      active
                        ? "border-white/34 bg-white/[0.095] shadow-[0_0_32px_rgba(255,255,255,0.08)]"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.055]"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <AdminUserAvatar
                          src={user.image}
                          name={getDisplayName(user)}
                          size="md"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-lg font-black text-white">
                              {getDisplayName(user)}
                            </div>
                            {active ? <Check className="h-4 w-4 text-emerald-200" /> : null}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {username ? (
                              <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-black text-white/70">
                                @{username}
                              </span>
                            ) : null}
                            <span className="break-all rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold text-white/48">
                              {user.lineId}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-right">
                        <MiniBalance label="NEX" value={user.nexPoint} />
                        <MiniBalance label="COIN" value={user.coin} />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {selectedUser ? (
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#101010,#050505)] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <AdminUserAvatar
                src={selectedUser.image}
                name={getDisplayName(selectedUser)}
                size="sm"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black">{getDisplayName(selectedUser)}</h2>
                  <UserCheck className="h-4 w-4 text-emerald-200" />
                </div>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  {selectedUsername ? `@${selectedUsername} • ` : ""}
                  {selectedUser.lineId}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ModeButton
                active={entryMode === "bank"}
                title="ธนาคารการ์ด"
                desc="คีย์การ์ดจริงเข้าระบบฝากสินทรัพย์ของลูกค้า"
                icon={Landmark}
                onClick={() => setEntryMode("bank")}
              />
              <ModeButton
                active={entryMode === "pawn"}
                title="จำนำการ์ด"
                desc="ย้ายเข้าระบบจำนำ คิดดอก 10% รายเดือน"
                icon={Banknote}
                onClick={() => setEntryMode("pawn")}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        {!selectedUser || !entryMode ? (
          <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-6 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-white/50" />
            <h2 className="mt-4 text-xl font-black">รอเลือกลูกค้าและประเภทรายการ</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-white/50">
              เมื่อเลือกครบแล้ว ระบบจะแสดงช่องคีย์ข้อมูลการ์ดแบบใช้งานเร็วด้านนี้
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">
                    {entryMode === "bank" ? "Card Bank Intake" : "Pawn Intake"}
                  </div>
                  <h2 className="mt-2 text-2xl font-black">
                    {entryMode === "bank" ? "???????????????????" : "????????????????"}
                  </h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-white/55">
                  {entryMode === "pawn" ? "ดอก 10% / เดือน" : "ค่าฝากรายเดือน"}
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <IntakeModeButton
                  active={intakeMode === "specific"}
                  title="ระบุการ์ดเป็นใบ"
                  desc="เลือกฟอยล์/ธรรมดา ค้นเลขการ์ด และระบุจำนวน"
                  onClick={() => setIntakeMode("specific")}
                />
                <IntakeModeButton
                  active={intakeMode === "sets"}
                  title="เซ็ตการ์ด"
                  desc="ลูกค้าจัดเซ็ตมาครบจากบ้าน เลือกเซ็ตและจำนวนเพื่อรับมูลค่า NEX ตามดาต้าเซ็ต"
                  onClick={() => setIntakeMode("sets")}
                />
                <IntakeModeButton
                  active={intakeMode === "bulk"}
                  title="กองรวม NEX / COIN"
                  desc="ไม่คัดใบ ใช้ยอดรวม และหักแบบไม่สนการ์ด"
                  onClick={() => setIntakeMode("bulk")}
                />
              </div>
            </div>

            {entryMode === "pawn" ? (
              <div className="rounded-[28px] border border-amber-300/18 bg-amber-300/[0.06] p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-100/55">
                      Pawn Terms
                    </div>
                    <h3 className="mt-2 text-xl font-black text-white">ข้อมูลจำนำที่จะส่งลงชีต</h3>
                  </div>
                  <div className="text-xs font-bold text-amber-100/65">
                    ใช้สำหรับคำนวณดอกและวันครบกำหนดอัตโนมัติ
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <LabeledInput
                    label="เงินต้น (THB)"
                    value={pawnPrincipal}
                    onChange={setPawnPrincipal}
                    inputMode="decimal"
                    placeholder="0"
                  />
                  <LabeledInput
                    label="ดอกเบี้ย / เดือน (%)"
                    value={pawnInterestRate}
                    onChange={setPawnInterestRate}
                    inputMode="decimal"
                    placeholder="10"
                  />
                  <LabeledInput
                    label="ครบกำหนด (วัน)"
                    value={pawnDueDays}
                    onChange={setPawnDueDays}
                    inputMode="numeric"
                    placeholder="30"
                  />
                  <LabeledInput
                    label="หมายเหตุ"
                    value={pawnNote}
                    onChange={setPawnNote}
                    placeholder="เช่น รับฝากจากลูกค้าประจำ"
                  />
                </div>
              </div>
            ) : null}

            {intakeMode === "specific" ? (
              <SpecificCardForm
                cardType={cardType}
                setCardType={setCardType}
                forcedFoil={forcedFoil}
                cardQuery={cardQuery}
                setCardQuery={setCardQuery}
                setCardError={setCardError}
                cardPreview={cardPreview}
                cardLoading={cardLoading}
                cardError={cardError}
                onEnterCard={openQuantityModal}
              />
            ) : intakeMode === "sets" ? (
              <CardSetForm
                setItems={cardSetItems}
                totalSetCount={totalSetCount}
                totalSetNex={totalSetNex}
                onOpenSetModal={() => setSetModalOpen(true)}
              />
            ) : (
              <BulkValueForm
                bulkNex={bulkNex}
                setBulkNex={setBulkNex}
                bulkCoin={bulkCoin}
                setBulkCoin={setBulkCoin}
                bulkCategory={bulkCategory}
                setBulkCategory={setBulkCategory}
              />
            )}

            <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">สรุปรายการก่อนบันทึก</h2>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-white/55">
                  {summaryBadgeLabel}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-white/52">
                เพิ่มรายการได้หลายชิ้นตามรูปแบบที่เลือก แล้วตรวจสรุปตรงนี้ก่อนกดบันทึกจริง เพื่อให้ข้อมูลถูกส่งไปที่เดียวแบบไม่ตกหล่น
              </p>

              {intakeMode === "specific" ? (
                <SpecificSummary items={items} setItems={setItems} />
              ) : intakeMode === "sets" ? (
                <CardSetSummary items={cardSetItems} setItems={setCardSetItems} />
              ) : (
                <BulkSummary bulkNex={bulkNex} bulkCoin={bulkCoin} bulkCategory={bulkCategory} />
              )}

              <SecurityLogPanel />

              {saveError ? (
                <div className="mt-4 rounded-[18px] border border-red-300/20 bg-red-500/10 p-3 text-sm font-bold leading-6 text-red-100">
                  {saveError}
                </div>
              ) : null}

              <button
                type="button"
                disabled={saving}
                onClick={submitDraft}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-[20px] bg-white px-4 py-4 text-sm font-black text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-500 disabled:text-zinc-900"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PackagePlus className="h-4 w-4" />
                )}
                {saving ? saveButtonBusyLabel : saveButtonLabel}
              </button>
            </div>
          </>
        )}
      </section>

      {quantityModalOpen ? (
        <QuantityModal
          quantityInput={quantityInput}
          setQuantityInput={setQuantityInput}
          onClose={() => setQuantityModalOpen(false)}
          onConfirm={confirmQuantity}
          inputRef={quantityInputRef}
          cardPreview={cardPreview}
          cardType={cardType}
        />
      ) : null}

      {setModalOpen ? (
        <CardSetModal
          onClose={() => setSetModalOpen(false)}
          onAddSet={addSetItem}
        />
      ) : null}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-black/20 p-4 text-sm font-bold text-white/42">
      {text}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        placeholder={placeholder}
        className="h-11 w-full rounded-[16px] border border-white/10 bg-black/30 px-3 text-sm font-bold text-white outline-none placeholder:text-white/30 focus:border-white/30"
      />
    </label>
  );
}

function MiniBalance({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-black/24 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
        {label}
      </div>
      <div className="mt-1 text-sm font-black text-white">{formatNumber(value)}</div>
    </div>
  );
}

function ModeButton({
  active,
  title,
  desc,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  icon: typeof Landmark;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[22px] border p-4 text-left transition ${
        active
          ? "border-white/34 bg-white/[0.11] text-white"
          : "border-white/10 bg-white/[0.035] text-white/72 hover:bg-white/[0.06]"
      }`}
    >
      <Icon className="h-5 w-5" />
      <div className="mt-3 text-lg font-black">{title}</div>
      <div className="mt-2 text-sm leading-6 text-white/52">{desc}</div>
    </button>
  );
}

function IntakeModeButton({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[20px] border p-4 text-left transition ${
        active
          ? "border-white/34 bg-white/[0.1]"
          : "border-white/10 bg-black/20 hover:bg-white/[0.045]"
      }`}
    >
      <div className="font-black text-white">{title}</div>
      <div className="mt-2 text-sm leading-6 text-white/52">{desc}</div>
    </button>
  );
}

function SpecificCardForm({
  cardType,
  setCardType,
  forcedFoil,
  cardQuery,
  setCardQuery,
  setCardError,
  cardPreview,
  cardLoading,
  cardError,
  onEnterCard,
}: {
  cardType: CardType;
  setCardType: (type: CardType) => void;
  forcedFoil: boolean;
  cardQuery: string;
  setCardQuery: (value: string) => void;
  setCardError: (value: string) => void;
  cardPreview: CardPreview | null;
  cardLoading: boolean;
  cardError: string;
  onEnterCard: () => void;
}) {
  const cardNo = cardPreview?.cardNo || normalizeCardNo(cardQuery);
  const selectableFoil = canChooseCardFinish(cardNo);
  const finishStatus = forcedFoil
    ? "เธเธฒเธฃเนเธ”เน€เธฅเธเธเธตเนเน€เธเนเธฟอยล์เน€เธงเธญเธฃเนเธเธฑเนเธเน€เธเนเธฒ เธฃเธฐเธเธเธฅเนเธญเธเน€เธเนเธ Foil เธญเธฑเธ•เนเธเธกเธฑเธ•เธด"
    : selectableFoil
      ? "เธเธฒเธฃเนเธ”เน€เธฅเธเธเธตเนเน€เธฅเธทเธญเธเธฃเธฐเธซเธงเนเธฒเธเธเธฃเธฃเธกเธ”เธฒเนเธฅเธฐฟอยล์เนเธ”เน"
      : "เธเธฒเธฃเนเธ”เน€เธฅเธเธเธตเนเนเธเนเธเธฒเธฃเนเธ”เธเธฃเธฃเธกเธ”เธฒเน€เธเนเธเธเนเธฒเน€เธฃเธดเนเธกเธ•เนเธ";

  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#0d0d0e,#050505)] p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_230px]">
        <div className="space-y-4">
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-black text-white">ประเภทการ์ด</div>
              <div
                className={`rounded-full border px-3 py-1 text-xs font-black ${
                  forcedFoil
                    ? "border-red-300/25 bg-red-500/12 text-red-100"
                    : "border-white/10 bg-white/[0.045] text-white/45"
                }`}
              >
                {finishStatus}
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <CardTypeButton
                active={cardType === "normal"}
                title="เธเธฒเธฃเนเธ”เธเธฃเธฃเธกเธ”เธฒ"
                icon={BadgeCheck}
                disabled={forcedFoil}
                lockReason="ฟอยล์เน€เธเนเธฒเธเธฑเธเธเธฑเธ เธฃเธฐเธเธเธซเนเธฒเธกเน€เธฅเธทเธญเธเธเธฃเธฃเธกเธ”เธฒ"
                onClick={() => setCardType("normal")}
              />
              <CardTypeButton
                active={forcedFoil || cardType === "foil"}
                title="เธเธฒเธฃเนเธ”ฟอยล์"
                icon={Sparkles}
                disabled={forcedFoil}
                lockReason="ฟอยล์เน€เธเนเธฒเธเธฑเธเธเธฑเธ เธฃเธฐเธเธเธฅเนเธญเธเน€เธเนเธฟอยล์เนเธซเนเธญเธฑเธ•เนเธเธกเธฑเธ•เธด"
                onClick={() => setCardType("foil")}
              />
            </div>
            {forcedFoil ? (
              <div className="mt-3 rounded-[18px] border border-red-300/18 bg-red-500/10 p-3 text-sm font-bold leading-6 text-red-100/82">
                เน€เธฅเธเธเธตเนเธญเธขเธนเนเนเธ Master เนเธเธฟอยล์เน€เธงเธญเธฃเนเธเธฑเนเธเน€เธเนเธฒ เธเธธเนเธกเน€เธฅเธทเธญเธเธเธฃเธฐเน€เธ เธ—เธเธถเธเธ–เธนเธเธฅเนเธญเธเธ—เธฑเนเธเธเธนเน
                เน€เธเธทเนเธญเธเธฑเธเนเธญเธ”เธกเธดเธเธเธตเธขเนเธเธดเธ” เธฃเธฒเธขเธเธฒเธฃเธ—เธตเนเธเธฐเธเธฑเธเธ—เธถเธเธเธฐเน€เธเนเธ Foil เน€เธ—เนเธฒเธเธฑเนเธ
              </div>
            ) : null}
          </div>

          <div>
            <div className="text-sm font-black text-white">ค้นหาการ์ด</div>
            <div className="mt-3 space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                <input
                  value={cardQuery}
                  onChange={(event) => {
                    setCardQuery(event.target.value);
                    setCardError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && cardPreview) {
                      event.preventDefault();
                      onEnterCard();
                    }
                  }}
                  placeholder="พิมพ์เลขการ์ด เช่น 010, 90, No.200 แล้วกด Enter"
                  className="h-14 w-full rounded-[20px] border border-white/10 bg-black/32 pl-12 pr-4 text-base font-bold text-white outline-none transition placeholder:text-white/35 focus:border-white/30 focus:ring-2 focus:ring-white/10"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onEnterCard}
                  disabled={!cardPreview}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[18px] border border-amber-300/18 bg-amber-300/[0.08] px-4 text-sm font-black text-amber-100 transition hover:bg-amber-300/[0.12] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-white/28"
                >
                  <PackagePlus className="h-4 w-4" />
                  เพิ่มรายการใบนี้
                </button>
                <div className="text-xs font-bold text-white/38">
                  กดปุ่มนี้หรือกด Enter เพื่อยืนยันจำนวนใบ
                </div>
              </div>
            </div>
            <div className="mt-2 min-h-5 text-xs font-bold text-white/38">
              {cardLoading ? "เธเธณเธฅเธฑเธเธ”เธถเธเธเนเธญเธกเธนเธฅเธเธฒเธฃเนเธ”..." : cardError || "เธเธดเธกเธเนเนเธฅเนเธงเธฃเธนเธเธเธฒเธฃเนเธ”เธเธฐเนเธชเธ”เธเธ”เนเธฒเธเธเนเธฒเธเธ—เธฑเธเธ—เธต"}
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-black/28 p-3">
          {cardPreview ? (
            <div className="relative">
              <div className="overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.035]">
                <img
                  src={cardPreview.imageUrl}
                  alt={cardPreview.cardName}
                  className="aspect-[815/1110] w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.src = `/cards/${cardPreview.cardNo}.jpg`;
                  }}
                />
              </div>
              <button
                type="button"
                onClick={onEnterCard}
                disabled={!cardPreview}
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[18px] border border-amber-300/18 bg-amber-300/[0.08] text-sm font-black text-amber-100 transition hover:bg-amber-300/[0.12] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-white/28"
              >
                <PackagePlus className="h-4 w-4" />
                เพิ่มรายการใบนี้
              </button>
              <div className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/38">
                No.{cardPreview.cardNo}
              </div>
              <div className="mt-1 text-sm font-black text-white">{cardPreview.cardName}</div>
              {cardLoading ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-white/45">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Syncing
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex aspect-[815/1110] items-center justify-center rounded-[18px] border border-dashed border-white/12 text-center text-sm font-bold leading-6 text-white/35">
              เธฃเธนเธเธเธฒเธฃเนเธ”เธเธฐเนเธชเธ”เธเธ•เธฃเธเธเธตเน
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CardTypeButton({
  active,
  title,
  icon: Icon,
  disabled = false,
  lockReason = "",
  onClick,
}: {
  active: boolean;
  title: string;
  icon: typeof BadgeCheck;
  disabled?: boolean;
  lockReason?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? lockReason : title}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-[18px] border px-4 py-3 text-sm font-black transition ${
        disabled
          ? "cursor-not-allowed border-red-300/18 bg-zinc-900/80 text-white/28 hover:border-red-300/24"
          : active
            ? "border-white/34 bg-white/[0.1] text-white"
            : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.055]"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="min-w-0 flex-1 text-left">{title}</span>
      {disabled ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-red-300/30 bg-red-500/12 text-[12px] text-red-200">
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </button>
  );
}

function SecurityLogPanel() {
  const rows = [
    "เธเธฑเธเธ—เธถเธเธเธนเนเธ—เธณเธฃเธฒเธขเธเธฒเธฃ, role, userId เธฅเธนเธเธเนเธฒ, IP/device, เน€เธงเธฅเธฒ เนเธฅเธฐ session id",
    "เน€เธเนเธ before/after snapshot เธ—เธธเธเธเธฃเธฑเนเธเธ—เธตเนเธฃเธฑเธเธเธฒเธ เนเธเนเนเธ เธขเนเธฒเธขเน€เธเนเธฒเนเธฃเธเธฃเธฑเธเธเธณเธเธณ เธซเธฃเธทเธญเนเธเธฅเธเน€เธเนเธ NEX / COIN",
    "เธฃเธฒเธขเธเธฒเธฃเนเธเธเธเธญเธเธฃเธงเธกเธ•เนเธญเธเธกเธตเธเธณเธขเธทเธเธขเธฑเธเธเธฒเธเธฅเธนเธเธเนเธฒเนเธฅเธฐเน€เธซเธ•เธธเธเธฅเธเธญเธเนเธญเธ”เธกเธดเธเธเนเธญเธเธเธฑเธเธ—เธถเธ",
    "เธฃเธฒเธขเธเธฒเธฃ forced foil เธ•เนเธญเธเธฅเนเธญเธ finish เน€เธเนเธ foil เนเธฅเธฐเธเธฑเธเธ—เธถเธเน€เธซเธ•เธธเธเธฅเธงเนเธฒเน€เธเนเธ Master forced-foil",
  ];

  return (
    <div className="mt-4 rounded-[24px] border border-white/10 bg-black/24 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.055]">
          <ShieldCheck className="h-5 w-5 text-white/70" />
        </div>
        <div>
          <div className="text-base font-black text-white">Security Logs เธ—เธตเนเธ•เนเธญเธเธเธฑเธเธ—เธถเธ</div>
          <div className="mt-1 text-sm leading-6 text-white/50">
            UI เธเธตเนเน€เธ•เธฃเธตเธขเธกเธเนเธญเธกเธนเธฅเธชเธณเธซเธฃเธฑเธ audit เธฃเธฐเธ”เธฑเธเธฅเธฐเน€เธญเธตเธขเธ” เธเนเธญเธเธ•เนเธญ API เธเธฑเธเธ—เธถเธเธเธฃเธดเธ
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {rows.map((row) => (
          <div key={row} className="flex gap-2 text-sm leading-6 text-white/58">
            <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-white/60" />
            <span>{row}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardSetForm({
  setItems,
  totalSetCount,
  totalSetNex,
  onOpenSetModal,
}: {
  setItems: DepositSetItem[];
  totalSetCount: number;
  totalSetNex: number;
  onOpenSetModal: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#0d0d0e,#050505)] p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-black text-white">เน€เธเนเธ•เธเธฒเธฃเนเธ”</div>
              <p className="mt-2 text-sm leading-7 text-white/55">
                เนเธเนเธชเธณเธซเธฃเธฑเธเธฅเธนเธเธเนเธฒเธ—เธตเนเธเธฑเธ”เน€เธเนเธ•เธเธฃเธเธกเธฒเน€เธญเธเธเธฒเธเธเนเธฒเธ เธฃเธฐเธเธเธเธฐเธ•เธตเธกเธนเธฅเธเนเธฒ NEX เธ•เธฒเธกเธเธธเธ”เนเธเธ”เธฒเธ•เนเธฒเน€เธเนเธ•เธ—เธฑเธเธ—เธต
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenSetModal}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[18px] border border-white/14 bg-white text-sm font-black text-black transition hover:bg-zinc-200"
            >
              <Layers3 className="h-4 w-4" />
              เน€เธฅเธทเธญเธเน€เธเนเธ•
            </button>
          </div>

          <div className="mt-4 rounded-[20px] border border-white/10 bg-black/24 p-4 text-sm leading-7 text-white/58">
            เธฅเธนเธเธเนเธฒเธ—เธตเนเนเธกเนเนเธ”เนเธเธฑเธ”เน€เธเนเธ•เธกเธฒ เธขเธฑเธเนเธเนเนเธซเธกเธ”เธเธญเธเธฃเธงเธก NEX / COIN เนเธ”เนเน€เธซเธกเธทเธญเธเน€เธ”เธดเธก เธชเนเธงเธเธฅเธนเธเธเนเธฒเธ—เธตเนเธเธฑเธ”เน€เธเนเธ•เธเธฃเธเธเธฐเนเธ”เนเธกเธนเธฅเธเนเธฒเธชเธนเธเธ•เธฒเธกเน€เธเนเธ•เธเธฑเนเธเธ—เธฑเธเธ—เธต
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <div className="rounded-[20px] border border-white/10 bg-black/24 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
              Sets
            </div>
            <div className="mt-1 text-2xl font-black text-white">
              {formatNumber(totalSetCount)}
            </div>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-black/24 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
              NEX Value
            </div>
            <div className="mt-1 text-2xl font-black text-white">
              {formatNumber(totalSetNex)}
            </div>
          </div>
        </div>
      </div>

      {setItems.length > 0 ? (
        <div className="mt-4 text-xs font-bold text-white/38">
          เน€เธฅเธทเธญเธเนเธฅเนเธง {formatNumber(setItems.length)} เธฃเธฒเธขเธเธฒเธฃ เธเธ”เธชเธฃเธธเธเธ”เนเธฒเธเธฅเนเธฒเธเน€เธเธทเนเธญเธ•เธฃเธงเธเธญเธตเธเธเธฃเธฑเนเธเธเนเธญเธเธเธฑเธเธ—เธถเธ
        </div>
      ) : null}
    </div>
  );
}

function BulkValueForm({
  bulkNex,
  setBulkNex,
  bulkCoin,
  setBulkCoin,
  bulkCategory,
  setBulkCategory,
}: {
  bulkNex: string;
  setBulkNex: (value: string) => void;
  bulkCoin: string;
  setBulkCoin: (value: string) => void;
  bulkCategory: BulkCategory;
  setBulkCategory: (value: BulkCategory) => void;
}) {
  const categoryOptions: Array<{ value: BulkCategory; label: string; desc: string }> = [
    { value: "pure", label: "NEX เน€เธเธตเธขเธง", desc: "เนเธกเนเนเธชเธ”เธเธเธเธดเธ”เธเธฒเธฃเนเธ”" },
    { value: "bronze", label: "Bronze", desc: "เธเธฑเธเน€เธเนเธเธเธฃเธญเธเธเน" },
    { value: "silver", label: "Silver", desc: "เธเธฑเธเน€เธเนเธเธเธดเธฅเน€เธงเธญเธฃเน" },
    { value: "gold", label: "Gold", desc: "เธเธฑเธเน€เธเนเธเนเธเธฅเธ”เน" },
    { value: "unknown", label: "UNKNOWN", desc: "เธเธฑเธเน€เธเนเธเธซเธกเธงเธ” UNKNOWN" },
  ];

  return (
    <div className="rounded-[28px] border border-red-300/18 bg-[linear-gradient(180deg,rgba(127,29,29,0.22),rgba(5,5,5,0.92))] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-red-200/20 bg-red-200/10 text-red-100">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-black text-red-50">ระบบกองรวม NEX / COIN</h2>
          <p className="mt-2 text-sm leading-7 text-red-100/78">
            เนเธซเธกเธ”เธเธตเนเนเธกเนเธฃเธฐเธเธธเธงเนเธฒเธเธฒเธเธเธฒเธฃเนเธ”เน€เธฅเธเธญเธฐเนเธฃ เนเธญเธ”เธกเธดเธเธ•เนเธญเธเธ•เธเธฅเธเธเธฑเธเธฅเธนเธเธเนเธฒเธเธฑเธ”เน€เธเธเธเนเธญเธ
            เน€เธเธฃเธฒเธฐเน€เธกเธทเนเธญเธฅเธนเธเธเนเธฒเนเธเนเธขเธญเธ”เธเธตเน เธฃเธฐเธเธเธเธฐเธซเธฑเธเธเธฒเธฃเนเธ”เนเธเธเนเธกเนเธชเธเนเธเนเธ/เน€เธเนเธ•/เธเธงเธฒเธกเนเธฃเธฃเนเธเธเธเธงเนเธฒเธขเธญเธ”เธเธฐเธซเธกเธ”
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-sm font-black text-white">เธเธฃเธฐเน€เธ เธ—เธเธญเธเธเธญเธเธเธตเน</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          {categoryOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setBulkCategory(option.value)}
              className={`rounded-[18px] border p-3 text-left transition ${
                bulkCategory === option.value
                  ? "border-white/34 bg-white/[0.12] text-white"
                  : "border-white/10 bg-black/24 text-white/58 hover:bg-white/[0.055]"
              }`}
            >
              <div className="text-sm font-black">{option.label}</div>
              <div className="mt-1 text-xs font-bold leading-5 text-white/42">{option.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-black text-white">เธขเธญเธ”เธฃเธงเธก NEX</span>
          <input
            value={bulkNex}
            onChange={(event) => setBulkNex(event.target.value)}
            inputMode="decimal"
            placeholder="เน€เธเนเธ 150000"
            className="mt-2 h-14 w-full rounded-[20px] border border-white/10 bg-black/32 px-4 text-base font-bold text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />
        </label>
        <label className="block">
          <span className="text-sm font-black text-white">เธขเธญเธ”เธฃเธงเธก COIN</span>
          <input
            value={bulkCoin}
            onChange={(event) => setBulkCoin(event.target.value)}
            inputMode="decimal"
            placeholder="เน€เธเนเธ 2500"
            className="mt-2 h-14 w-full rounded-[20px] border border-white/10 bg-black/32 px-4 text-base font-bold text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />
        </label>
      </div>

      <div className="mt-4 rounded-[20px] border border-white/10 bg-black/26 p-4 text-sm leading-7 text-white/58">
        เน€เธซเธกเธฒเธฐเธเธฑเธเน€เธเธชเธ—เธตเนเธฅเธนเธเธเนเธฒเธเธฒเธเธเธฒเธฃเนเธ”เธเธณเธเธงเธเธกเธฒเธเน€เธเธทเนเธญเนเธเนเน€เธเนเธเธงเธเน€เธเธดเธเธเธทเนเธญเธชเธดเธเธเนเธฒ
        เธซเธฅเธฑเธเธฅเธนเธเธเนเธฒเธชเนเธเธเธณเธเธญ เนเธญเธ”เธกเธดเธเธเธณเธฃเธฐเนเธซเนเธฃเนเธฒเธเธเนเธฒเธเธฅเธฒเธขเธ—เธฒเธเนเธเน€เธงเธฅเธฒเธ—เธณเธเธฒเธฃ
        เนเธฅเนเธงเธซเธฑเธ NEX / COIN เธเธฒเธเธเธญเธเธฃเธงเธกเธ•เธฒเธกเธขเธญเธ”เธ—เธตเนเนเธเน
      </div>
    </div>
  );
}

function SpecificSummary({
  items,
  setItems,
}: {
  items: DepositItem[];
  setItems: (value: DepositItem[]) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="mt-4 rounded-[20px] border border-white/10 bg-black/20 p-4 text-sm font-bold text-white/42">
        เธขเธฑเธเนเธกเนเธกเธตเธเธฒเธฃเนเธ”เนเธเธฃเธฒเธขเธเธฒเธฃ เธเธฃเธญเธเน€เธฅเธเธเธฒเธฃเนเธ”เนเธฅเนเธงเธเธ” Enter เน€เธเธทเนเธญเธฃเธฐเธเธธเธเธณเธเธงเธ
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3 rounded-[20px] border border-white/10 bg-black/24 p-3">
          <img
            src={item.imageUrl}
            alt={item.cardName}
            className="h-20 w-14 rounded-[12px] object-cover"
            onError={(event) => {
              event.currentTarget.src = `/cards/${item.cardNo}.jpg`;
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
              No.{item.cardNo} • {item.cardType === "foil" ? "Foil" : "Normal"}
            </div>
            <div className="mt-1 truncate font-black text-white">{item.cardName}</div>
            <div className="mt-2 text-sm font-bold text-white/55">
              เธเธณเธเธงเธ {item.quantity.toLocaleString("th-TH")} เนเธ
            </div>
          </div>
          <button
            type="button"
            onClick={() => setItems(items.filter((current) => current.id !== item.id))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-red-300/20 bg-red-500/10 text-red-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function CardSetSummary({
  items,
  setItems,
}: {
  items: DepositSetItem[];
  setItems: (value: DepositSetItem[]) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="mt-4 rounded-[20px] border border-white/10 bg-black/20 p-4 text-sm font-bold text-white/42">
        ยังไม่มีเซ็ตการ์ดในรายการ กดปุ่มเลือกเซ็ตแล้วระบุจำนวนชุดที่ลูกค้าจัดมา
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-[20px] border border-white/10 bg-black/24 p-3">
          <div className="flex gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.055] text-sm font-black text-white">
              {item.order}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
                Set {item.order} • {item.cardTotal} cards
              </div>
              <div className="mt-1 truncate font-black text-white">{item.setName}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-white/62">
                  {formatNumber(item.quantity)} เน€เธเนเธ•
                </span>
                <span className="rounded-full border border-emerald-200/18 bg-emerald-400/10 px-3 py-1 text-emerald-100">
                  {formatNumber(item.nexValue * item.quantity)} NEX
                </span>
                {item.nexValue !== item.fullNexValue ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-white/55">
                    เน€เธ•เนเธก {formatNumber(item.fullNexValue * item.quantity)} NEX
                  </span>
                ) : null}
                {item.withFoilBonus ? (
                  <span className="rounded-full border border-amber-200/18 bg-amber-300/10 px-3 py-1 text-amber-100">
                    เธฃเธงเธกเน€เธเธทเนเธญเธเนเธฟอยล์
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setItems(items.filter((current) => current.id !== item.id))}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-red-300/20 bg-red-500/10 text-red-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 rounded-[16px] border border-white/8 bg-black/22 p-3 text-xs font-bold leading-6 text-white/48">
            {item.reward}
          </div>
        </div>
      ))}
    </div>
  );
}

function CardSetModal({
  onClose,
  onAddSet,
}: {
  onClose: () => void;
  onAddSet: (
    set: NexoraCollectionSet,
    quantity: number,
    withFoilBonus: boolean,
    receivedNexValue?: number
  ) => void;
}) {
  const [quantityBySet, setQuantityBySet] = useState<Record<string, string>>({});
  const [foilBonusBySet, setFoilBonusBySet] = useState<Record<string, boolean>>({});
  const [receivedNexBySet, setReceivedNexBySet] = useState<Record<string, string>>({});
  const [recentlyAddedSetId, setRecentlyAddedSetId] = useState<string>("");
  const [toastText, setToastText] = useState("");
  const toastTimerRef = useRef<number | null>(null);
  const allSets = useMemo(
    () => [...nexoraCollectionSets].sort((a, b) => a.order - b.order),
    []
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showAddedToast = (setId: string, setName: string) => {
    setRecentlyAddedSetId(setId);
    setToastText(`เพิ่มรายการแล้ว: ${setName}`);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setRecentlyAddedSetId("");
      setToastText("");
      toastTimerRef.current = null;
    }, 1400);
  };

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-3 sm:p-5">
      <button
        type="button"
        aria-label="เธเธดเธ”เธซเธเนเธฒเธ•เนเธฒเธเน€เธฅเธทเธญเธเน€เธเนเธ•"
        onClick={onClose}
        className="absolute inset-0 bg-black/78 backdrop-blur-md"
      />
      <div className="relative flex max-h-[92dvh] w-full max-w-[1360px] flex-col overflow-hidden rounded-[30px] border border-white/14 bg-[linear-gradient(180deg,#141414,#050505)] shadow-[0_35px_140px_rgba(0,0,0,0.72)]">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-white/35">
              Collection Sets
            </div>
            <h2 className="mt-2 text-2xl font-black text-white">เน€เธฅเธทเธญเธเน€เธเนเธ•เธเธฒเธฃเนเธ” 40 เน€เธเนเธ•</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              เธฃเธฐเธเธธเธเธณเธเธงเธเน€เธเนเธ•เธเนเธฒเธเธเธธเนเธกเน€เธเธดเนเธก เนเธฅเธฐเธ•เธดเนเธเน€เธเธทเนเธญเธเนเธฟอยล์เน€เธกเธทเนเธญเธเธธเธ”เธเธฑเนเธเธเธฑเธ”เธเธฃเธเธ•เธฒเธกเธเธ•เธดเธเธฒเน€เธชเธฃเธดเธก
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.055] text-white/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-2">
            {allSets.map((set) => {
              const quantityValue = quantityBySet[set.id] ?? "1";
              const withFoilBonus = Boolean(foilBonusBySet[set.id]);
              const baseValue = parseNexReward(set.reward, false);
              const activeValue = parseNexReward(set.reward, withFoilBonus);
              const receivedValue = receivedNexBySet[set.id] ?? "";
              const conditionText = getSetConditionText(set);
              const cardTotal = set.officialTotal || getCollectionCardIds(set).length;

              return (
                <div
                  key={set.id}
                  className={`relative flex min-h-full flex-col rounded-[22px] border bg-black/24 p-3 sm:p-4 transition duration-300 ${
                    recentlyAddedSetId === set.id
                      ? "border-amber-200/35 shadow-[0_0_0_1px_rgba(252,211,77,0.15),0_0_38px_rgba(250,204,21,0.22)] ring-1 ring-amber-200/25"
                      : "border-white/10"
                  }`}
                >
                  {recentlyAddedSetId === set.id ? (
                    <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.12),transparent_55%)] animate-pulse" />
                  ) : null}
                  {recentlyAddedSetId === set.id ? (
                    <div className="absolute right-3 top-3 rounded-full border border-amber-200/25 bg-amber-300/12 px-3 py-1 text-[10px] font-black tracking-[0.22em] text-amber-100 shadow-[0_0_18px_rgba(250,204,21,0.25)]">
                      เพิ่มรายการแล้ว
                    </div>
                  ) : null}
                  <div className="grid flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-9 min-w-9 items-center justify-center rounded-[13px] border border-white/10 bg-white/[0.06] px-2 text-sm font-black text-white">
                          {set.order}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-base font-black text-white">
                          {set.name}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-[11px] font-black text-white/52">
                          {cardTotal} เนเธ
                        </span>
                      </div>
                      <div className="mt-2 line-clamp-2 text-sm leading-6 text-white/52">
                        {set.reward}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-black">
                        <span className="rounded-full border border-emerald-200/16 bg-emerald-400/10 px-3 py-1 text-emerald-100">
                          {baseValue > 0 ? `${formatNumber(baseValue)} NEX` : "เธฃเธฒเธเธงเธฑเธฅเธเธดเน€เธจเธฉ"}
                        </span>
                        {withFoilBonus && activeValue !== baseValue ? (
                          <span className="rounded-full border border-amber-200/18 bg-amber-300/10 px-3 py-1 text-amber-100">
                            เน€เธเธดเนเธกเน€เธเนเธ {formatNumber(activeValue)} NEX
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-[minmax(76px,1fr)_104px] gap-2">
                      <div className="space-y-2">
                        <input
                          value={quantityValue}
                          onChange={(event) =>
                            setQuantityBySet((current) => ({
                              ...current,
                              [set.id]: event.target.value,
                            }))
                          }
                          inputMode="numeric"
                          aria-label={`เธเธณเธเธงเธเน€เธเนเธ• ${set.order}`}
                          className="h-12 min-w-0 w-full rounded-[16px] border border-white/10 bg-black/40 px-3 text-center text-base font-black text-white outline-none placeholder:text-white/25 focus:border-white/35"
                        />
                        <input
                          value={receivedValue}
                          onChange={(event) =>
                            setReceivedNexBySet((current) => ({
                              ...current,
                              [set.id]: event.target.value,
                            }))
                          }
                          inputMode="numeric"
                          aria-label={`เธขเธญเธ”เธ—เธตเนเธฃเธฑเธเธชเธณเธซเธฃเธฑเธเน€เธเนเธ• ${set.order}`}
                          placeholder={`เน€เธ•เนเธก ${formatNumber(activeValue)} NEX`}
                          className="h-12 min-w-0 w-full rounded-[16px] border border-white/10 bg-black/40 px-3 text-center text-sm font-black text-white outline-none placeholder:text-white/28 focus:border-white/35"
                        />
                        <div className="text-[11px] font-bold tracking-[0.08em] text-white/34">
                          เน€เธงเนเธเธงเนเธฒเธ = เธฃเธฑเธเธขเธญเธ”เน€เธ•เนเธกเธเธญเธเน€เธเนเธ•
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const parsedReceived = Number(receivedValue);
                          const finalReceived =
                            Number.isFinite(parsedReceived) && parsedReceived > 0
                              ? Math.min(parsedReceived, activeValue || parsedReceived)
                              : activeValue;
                          onAddSet(
                            set,
                            Number(quantityValue || 1),
                            withFoilBonus,
                            finalReceived
                          );
                          showAddedToast(set.id, set.name);
                        }}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] bg-white px-3 text-sm font-black text-black transition hover:bg-zinc-200 active:scale-[0.98]"
                      >
                        <PackagePlus className="h-4 w-4" />
                        เน€เธเธดเนเธก
                      </button>
                    </div>
                  </div>

                  {conditionText ? (
                    <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-[18px] border border-amber-200/14 bg-amber-300/[0.06] p-3 text-sm leading-6 text-amber-50/82">
                      <input
                        type="checkbox"
                        checked={withFoilBonus}
                        onChange={(event) =>
                          setFoilBonusBySet((current) => ({
                            ...current,
                            [set.id]: event.target.checked,
                          }))
                        }
                        className="mt-1 h-4 w-4 shrink-0 accent-amber-200"
                      />
                      <span className="min-w-0">
                        ใช้เงื่อนไขฟอยล์เพิ่ม: {conditionText}
                      </span>
                    </label>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/10 p-3 sm:p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-full items-center justify-center rounded-[18px] border border-white/12 bg-white/[0.06] text-sm font-black text-white transition hover:bg-white/[0.1]"
          >
            เธเธดเธ”เธซเธเนเธฒเธ•เนเธฒเธ
          </button>
        </div>
      </div>
      {toastText ? (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-[1450] -translate-x-1/2">
          <div className="rounded-full border border-amber-200/20 bg-[linear-gradient(180deg,rgba(255,244,184,0.95),rgba(245,158,11,0.82))] px-4 py-2 text-xs font-black tracking-[0.16em] text-black shadow-[0_14px_40px_rgba(251,191,36,0.35)] animate-pulse">
            {toastText}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BulkSummary({
  bulkNex,
  bulkCoin,
  bulkCategory,
}: {
  bulkNex: string;
  bulkCoin: string;
  bulkCategory: BulkCategory;
}) {
  const categoryLabel =
    bulkCategory === "pure"
      ? "NEX/COIN เน€เธเธตเธขเธง เนเธกเนเธฃเธฐเธเธธเธเธฒเธฃเนเธ”"
      : bulkCategory === "unknown"
        ? "เธเธญเธเธเธฒเธฃเนเธ”เธซเธกเธงเธ” UNKNOWN"
      : `${bulkCategory.toUpperCase()} card pool`;

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div className="rounded-[20px] border border-white/10 bg-black/24 p-4">
        <Layers3 className="h-5 w-5 text-white/60" />
        <div className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
          Pool Type
        </div>
        <div className="mt-1 text-lg font-black text-white">{categoryLabel}</div>
      </div>
      <div className="rounded-[20px] border border-white/10 bg-black/24 p-4">
        <CircleDollarSign className="h-5 w-5 text-white/60" />
        <div className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
          NEX Pool
        </div>
        <div className="mt-1 text-2xl font-black text-white">{bulkNex || "0"}</div>
      </div>
      <div className="rounded-[20px] border border-white/10 bg-black/24 p-4">
        <CircleDollarSign className="h-5 w-5 text-white/60" />
        <div className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
          COIN Pool
        </div>
        <div className="mt-1 text-2xl font-black text-white">{bulkCoin || "0"}</div>
      </div>
    </div>
  );
}

function QuantityModal({
  quantityInput,
  setQuantityInput,
  onClose,
  onConfirm,
  inputRef,
  cardPreview,
  cardType,
}: {
  quantityInput: string;
  setQuantityInput: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  cardPreview: CardPreview | null;
  cardType: CardType;
}) {
  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="เธเธดเธ”เธซเธเนเธฒเธ•เนเธฒเธ"
        onClick={onClose}
        className="absolute inset-0 bg-black/78 backdrop-blur-md"
      />
      <div className="relative w-full max-w-[460px] rounded-[30px] border border-white/14 bg-[linear-gradient(180deg,#141414,#050505)] p-5 shadow-[0_35px_140px_rgba(0,0,0,0.72)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.055] text-white/70"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="pr-10">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-white/35">
            Quantity Confirm
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">เธฃเธฐเธเธธเธเธณเธเธงเธเธเธฒเธฃเนเธ”</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">
            {cardPreview
              ? `No.${cardPreview.cardNo} • ${cardPreview.cardName} • ${
                  cardType === "foil" ? "เธเธฒเธฃเนเธ”ฟอยล์" : "เธเธฒเธฃเนเธ”เธเธฃเธฃเธกเธ”เธฒ"
                }`
              : "เธฃเธฒเธขเธเธฒเธฃเธเธฒเธฃเนเธ”"}
          </p>
        </div>

        <input
          ref={inputRef}
          value={quantityInput}
          onChange={(event) => setQuantityInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onConfirm();
            }
            if (event.key === "Escape") {
              onClose();
            }
          }}
          inputMode="numeric"
          placeholder="เธเธณเธเธงเธ เน€เธเนเธ 1"
          className="mt-5 h-16 w-full rounded-[22px] border border-white/12 bg-black/40 px-4 text-center text-2xl font-black text-white outline-none placeholder:text-white/25 focus:border-white/35 focus:ring-2 focus:ring-white/10"
        />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[20px] border border-red-300/20 bg-red-500/14 px-4 py-4 text-sm font-black text-red-100 transition hover:bg-red-500/20"
          >
            เธขเธเน€เธฅเธดเธ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-[20px] bg-white px-4 py-4 text-sm font-black text-black transition hover:bg-zinc-200"
          >
            เธขเธทเธเธขเธฑเธ
          </button>
        </div>
      </div>
    </div>
  );
}

