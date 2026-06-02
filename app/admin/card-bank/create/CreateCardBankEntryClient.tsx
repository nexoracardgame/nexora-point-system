"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  BadgeCheck,
  Check,
  CircleDollarSign,
  Landmark,
  Loader2,
  PackagePlus,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";

type UserRow = {
  id: string;
  name: string | null;
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
  quantity: number;
  imageUrl: string;
};

type EntryMode = "bank" | "pawn";
type IntakeMode = "specific" | "bulk";
type CardType = "normal" | "foil";

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
  const [quantityInput, setQuantityInput] = useState("1");
  const [items, setItems] = useState<DepositItem[]>([]);
  const [bulkNex, setBulkNex] = useState("");
  const [bulkCoin, setBulkCoin] = useState("");
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

  useEffect(() => {
    const cardNo = normalizeCardNo(cardQuery);
    setCardError("");

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

  useEffect(() => {
    if (!quantityModalOpen) return;
    const timer = window.setTimeout(() => quantityInputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [quantityModalOpen]);

  const selectedUsername = String(selectedUser?.username || "").trim().replace(/^@+/, "");
  const totalSpecificCards = items.reduce((sum, item) => sum + item.quantity, 0);

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

    const itemId = `${cardPreview.cardNo}-${cardType}-${Date.now()}`;
    setItems((current) => [
      ...current,
      {
        id: itemId,
        cardNo: cardPreview.cardNo,
        cardName: cardPreview.cardName,
        cardType,
        quantity,
        imageUrl: cardPreview.imageUrl,
      },
    ]);
    setQuantityModalOpen(false);
    setCardQuery("");
    setCardPreview(null);
  };

  const submitDraft = () => {
    if (!selectedUser || !entryMode) {
      alert("เลือกยูสเซอร์และประเภทรายการก่อน");
      return;
    }

    if (intakeMode === "specific" && items.length === 0) {
      alert("เพิ่มรายการการ์ดอย่างน้อย 1 รายการก่อน");
      return;
    }

    if (intakeMode === "bulk" && !bulkNex.trim() && !bulkCoin.trim()) {
      alert("กรอกยอดรวม NEX หรือ COIN สำหรับระบบกองรวมก่อน");
      return;
    }

    alert("เตรียมข้อมูลรายการเรียบร้อยแล้ว ขั้นต่อไปคือเชื่อม API/ฐานข้อมูล Card Bank เพื่อบันทึกจริง");
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
              <h2 className="text-xl font-black">เลือกยูสเซอร์</h2>
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
                      <div className="min-w-0">
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
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.055]">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-black">{getDisplayName(selectedUser)}</h2>
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
            <h2 className="mt-4 text-xl font-black">รอเลือกผู้ใช้และประเภทรายการ</h2>
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
                    {entryMode === "bank" ? "คีย์เข้าธนาคารการ์ด" : "คีย์เข้าระบบจำนำ"}
                  </h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-white/55">
                  {entryMode === "pawn" ? "ดอก 10% / เดือน" : "ค่าฝากรายเดือน"}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <IntakeModeButton
                  active={intakeMode === "specific"}
                  title="ระบุการ์ดเป็นใบ"
                  desc="เลือกฟอยล์/ธรรมดา ค้นเลขการ์ด และระบุจำนวน"
                  onClick={() => setIntakeMode("specific")}
                />
                <IntakeModeButton
                  active={intakeMode === "bulk"}
                  title="กองรวม NEX / COIN"
                  desc="ไม่คัดใบ ใช้ยอดรวม และหักแบบไม่สนการ์ด"
                  onClick={() => setIntakeMode("bulk")}
                />
              </div>
            </div>

            {intakeMode === "specific" ? (
              <SpecificCardForm
                cardType={cardType}
                setCardType={setCardType}
                cardQuery={cardQuery}
                setCardQuery={setCardQuery}
                cardPreview={cardPreview}
                cardLoading={cardLoading}
                cardError={cardError}
                onEnterCard={openQuantityModal}
              />
            ) : (
              <BulkValueForm
                bulkNex={bulkNex}
                setBulkNex={setBulkNex}
                bulkCoin={bulkCoin}
                setBulkCoin={setBulkCoin}
              />
            )}

            <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">สรุปรายการก่อนบันทึก</h2>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-white/55">
                  {intakeMode === "specific"
                    ? `${totalSpecificCards} ใบ`
                    : "กองรวม"}
                </span>
              </div>

              {intakeMode === "specific" ? (
                <SpecificSummary items={items} setItems={setItems} />
              ) : (
                <BulkSummary bulkNex={bulkNex} bulkCoin={bulkCoin} />
              )}

              <button
                type="button"
                onClick={submitDraft}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-[20px] bg-white px-4 py-4 text-sm font-black text-black transition hover:bg-zinc-200"
              >
                <PackagePlus className="h-4 w-4" />
                เตรียมบันทึกรายการ
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
  cardQuery,
  setCardQuery,
  cardPreview,
  cardLoading,
  cardError,
  onEnterCard,
}: {
  cardType: CardType;
  setCardType: (type: CardType) => void;
  cardQuery: string;
  setCardQuery: (value: string) => void;
  cardPreview: CardPreview | null;
  cardLoading: boolean;
  cardError: string;
  onEnterCard: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#0d0d0e,#050505)] p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_230px]">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-black text-white">ประเภทการ์ด</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <CardTypeButton
                active={cardType === "normal"}
                title="การ์ดธรรมดา"
                icon={BadgeCheck}
                onClick={() => setCardType("normal")}
              />
              <CardTypeButton
                active={cardType === "foil"}
                title="การ์ดฟอยล์"
                icon={Sparkles}
                onClick={() => setCardType("foil")}
              />
            </div>
          </div>

          <div>
            <div className="text-sm font-black text-white">ค้นหาการ์ด</div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
              <input
                value={cardQuery}
                onChange={(event) => setCardQuery(event.target.value)}
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
            <div className="mt-2 min-h-5 text-xs font-bold text-white/38">
              {cardLoading ? "กำลังดึงข้อมูลการ์ด..." : cardError || "พิมพ์แล้วรูปการ์ดจะแสดงด้านข้างทันที"}
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-black/28 p-3">
          {cardPreview ? (
            <div>
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
              รูปการ์ดจะแสดงตรงนี้
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
  onClick,
}: {
  active: boolean;
  title: string;
  icon: typeof BadgeCheck;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-[18px] border px-4 py-3 text-sm font-black transition ${
        active
          ? "border-white/34 bg-white/[0.1] text-white"
          : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.055]"
      }`}
    >
      <Icon className="h-4 w-4" />
      {title}
    </button>
  );
}

function BulkValueForm({
  bulkNex,
  setBulkNex,
  bulkCoin,
  setBulkCoin,
}: {
  bulkNex: string;
  setBulkNex: (value: string) => void;
  bulkCoin: string;
  setBulkCoin: (value: string) => void;
}) {
  return (
    <div className="rounded-[28px] border border-red-300/18 bg-[linear-gradient(180deg,rgba(127,29,29,0.22),rgba(5,5,5,0.92))] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-red-200/20 bg-red-200/10 text-red-100">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-black text-red-50">ระบบกองรวม NEX / COIN</h2>
          <p className="mt-2 text-sm leading-7 text-red-100/78">
            โหมดนี้ไม่ระบุว่าฝากการ์ดเลขอะไร แอดมินต้องตกลงกับลูกค้าชัดเจนก่อน
            เพราะเมื่อลูกค้าใช้ยอดนี้ ระบบจะหักการ์ดแบบไม่สนใจใบ/เซ็ต/ความแรร์จนกว่ายอดจะหมด
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-black text-white">ยอดรวม NEX</span>
          <input
            value={bulkNex}
            onChange={(event) => setBulkNex(event.target.value)}
            inputMode="decimal"
            placeholder="เช่น 150000"
            className="mt-2 h-14 w-full rounded-[20px] border border-white/10 bg-black/32 px-4 text-base font-bold text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />
        </label>
        <label className="block">
          <span className="text-sm font-black text-white">ยอดรวม COIN</span>
          <input
            value={bulkCoin}
            onChange={(event) => setBulkCoin(event.target.value)}
            inputMode="decimal"
            placeholder="เช่น 2500"
            className="mt-2 h-14 w-full rounded-[20px] border border-white/10 bg-black/32 px-4 text-base font-bold text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />
        </label>
      </div>

      <div className="mt-4 rounded-[20px] border border-white/10 bg-black/26 p-4 text-sm leading-7 text-white/58">
        เหมาะกับเคสที่ลูกค้าฝากการ์ดจำนวนมากเพื่อใช้เป็นวงเงินซื้อสินค้า
        หลังลูกค้าส่งคำขอ แอดมินชำระให้ร้านค้าปลายทางในเวลาทำการ
        แล้วหัก NEX / COIN จากกองรวมตามยอดที่ใช้
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
        ยังไม่มีการ์ดในรายการ กรอกเลขการ์ดแล้วกด Enter เพื่อระบุจำนวน
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
              จำนวน {item.quantity.toLocaleString("th-TH")} ใบ
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

function BulkSummary({ bulkNex, bulkCoin }: { bulkNex: string; bulkCoin: string }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
        aria-label="ปิดหน้าต่าง"
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
          <h2 className="mt-2 text-2xl font-black text-white">ระบุจำนวนการ์ด</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">
            {cardPreview
              ? `No.${cardPreview.cardNo} • ${cardPreview.cardName} • ${
                  cardType === "foil" ? "การ์ดฟอยล์" : "การ์ดธรรมดา"
                }`
              : "รายการการ์ด"}
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
          placeholder="จำนวน เช่น 1"
          className="mt-5 h-16 w-full rounded-[22px] border border-white/12 bg-black/40 px-4 text-center text-2xl font-black text-white outline-none placeholder:text-white/25 focus:border-white/35 focus:ring-2 focus:ring-white/10"
        />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[20px] border border-red-300/20 bg-red-500/14 px-4 py-4 text-sm font-black text-red-100 transition hover:bg-red-500/20"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-[20px] bg-white px-4 py-4 text-sm font-black text-black transition hover:bg-zinc-200"
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}
