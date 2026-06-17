import {
  AlertTriangle,
  ArrowRightLeft,
  BadgeCheck,
  Banknote,
  CalendarClock,
  CircleDollarSign,
  FileText,
  Layers3,
  Landmark,
  LockKeyhole,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getCardBankAssetsForUser,
  getCardBankAssetsVersion,
  type CardBankAsset,
} from "@/lib/card-bank-store";
import CardBankRealtimeRefresh from "./CardBankRealtimeRefresh";

export const dynamic = "force-dynamic";

type BankCard = {
  id: string;
  cardNo: string;
  name: string;
  tier: string;
  intakeMode: "specific" | "sets" | "bulk";
  quantity: number;
  nexValue: number;
  coinValue: number;
  setCardTotal: number | null;
  assetTier: string;
  valueTHB: number;
  status: "stored" | "pawned";
  nextFeeDate: string;
};

type PawnCard = BankCard & {
  pawnStartedAt: string;
  interestDueDate: string;
  monthlyInterestTHB: number;
  lateDays: number;
};

type BulkAssetPool = {
  id: string;
  label: string;
  category: string;
  nexBalance: number;
  coinBalance: number;
  pileCount: number;
  updatedAt: string;
};

function getAssetTierLabel(tier: string) {
  if (tier === "pure") return "กอง NEX / COIN ไม่ระบุหมวดการ์ด";
  if (tier === "unknown") return "กองการ์ดหมวด UNKNOWN";
  return `กองการ์ดหมวด ${tier.toUpperCase()}`;
}

const bankTerms = [
  "ระบบธนาคารการ์ดจะแสดงข้อมูลเฉพาะการ์ดจริงที่ลูกค้านำมาฝาก และแอดมินคีย์เข้าหลังบ้านแล้วเท่านั้น",
  "การ์ดที่ฝากในธนาคารมีค่าฝากรายเดือน แยกจากดอกเบี้ยของโหมดรับฝากการ์ด",
  "ลูกค้าสามารถเลือกการ์ดในธนาคารเพื่อโยกย้ายไปแปลงเป็น NEX / COIN หรือเข้าโหมดรับฝากการ์ดได้เอง เมื่อระบบหลังบ้านเปิดใช้งานครบ",
  "ถ้าแปลงการ์ดเป็น NEX / COIN แล้ว การ์ดใบนั้นจะถูกตัดออกจากธนาคารทันทีและไม่สามารถไถ่ถอนคืนได้",
];

const pawnTerms = [
  "รับฝากการ์ดใช้ได้เฉพาะการ์ดที่อยู่ในระบบธนาคารการ์ดแล้วเท่านั้น",
  "รับยอดได้ไม่เกิน 80% ของมูลค่าจริง ดอกเบี้ยรายเดือนคิด 5% จากเงินต้น และบวกค่ารักษา 200 บาทต่อรายการ",
  "ล่าช้า 1-3 วันแรกไม่คิดค่าปรับเพิ่ม แต่ยังขึ้นสถานะแจ้งเตือนให้ชำระ",
  "ล่าช้าได้สูงสุดไม่เกิน 7 วัน หากเกิน 7 วัน การ์ดจะหลุดถาวรและไม่สามารถไถ่ถอนได้",
];

const processSteps = [
  {
    title: "ฝากการ์ดจริง",
    desc: "ลูกค้านำการ์ดจริงเข้าบริษัท พร้อมยืนยันเจ้าของและหลักฐานรับฝาก",
    icon: PackageCheck,
  },
  {
    title: "แอดมินตรวจและคีย์",
    desc: "แอดมินตรวจสภาพ ประเภท มูลค่า รูปหลักฐาน แล้วคีย์เข้าระบบธนาคาร",
    icon: ShieldCheck,
  },
  {
    title: "ลูกค้าเช็คเรียลไทม์",
    desc: "หลังคีย์แล้ว ลูกค้าจะเห็นการ์ดของตัวเอง พร้อมสถานะ ค่าฝาก และตัวเลือกจัดการ",
    icon: WalletCards,
  },
  {
    title: "โยกย้ายสินทรัพย์",
    desc: "เลือกถอนจริง แปลงเป็น NEX / COIN หรือเข้าโหมดรับฝากตามเงื่อนไขของระบบ",
    icon: ArrowRightLeft,
  },
];

function formatTHB(value: number) {
  return value.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  });
}

function formatThaiDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function addMonths(value: string, months: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date();
  date.setMonth(date.getMonth() + months);
  return date;
}

function mapBankCard(asset: CardBankAsset): BankCard {
  return {
    id: asset.id,
    cardNo: asset.cardNo ? `No.${asset.cardNo}` : asset.setId || "SET",
    name: asset.cardName,
    tier:
      asset.intakeMode === "sets"
        ? `เซ็ตการ์ด${asset.withFoilBonus ? " + Foil bonus" : ""}`
        : asset.cardType || asset.intakeMode,
    intakeMode: asset.intakeMode,
    quantity: asset.quantity,
    nexValue: asset.nexValue,
    coinValue: asset.coinValue,
    setCardTotal: asset.setCardTotal,
    assetTier: asset.assetTier,
    valueTHB: asset.valueTHB,
    status: asset.status === "pawned" ? "pawned" : "stored",
    nextFeeDate: formatThaiDate(addMonths(asset.createdAt, 1).toISOString()),
  };
}

function mapPawnCard(asset: CardBankAsset): PawnCard {
  const base = mapBankCard(asset);
  const dueDate = addMonths(asset.createdAt, 1);
  const today = new Date();
  const pawn = asset.sourcePayload && typeof asset.sourcePayload === "object"
    ? (asset.sourcePayload.pawn as Record<string, unknown> | undefined)
    : undefined;
  const principalTHB = Math.max(
    0,
    Number(pawn?.principalTHB || Math.round(asset.valueTHB * 0.8))
  );
  const lateDays = Math.max(
    0,
    Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000)
  );

  return {
    ...base,
    status: "pawned",
    pawnStartedAt: formatThaiDate(asset.createdAt),
    interestDueDate: formatThaiDate(dueDate.toISOString()),
    monthlyInterestTHB: Math.round(principalTHB * 0.05) + 200,
    lateDays,
  };
}

function mapBulkPool(asset: CardBankAsset): BulkAssetPool {
  return {
    id: asset.id,
    label: getAssetTierLabel(asset.assetTier),
    category: asset.assetTier,
    nexBalance: asset.nexValue,
    coinBalance: asset.coinValue,
    pileCount: asset.quantity,
    updatedAt: formatThaiDate(asset.updatedAt),
  };
}

export default async function CardBankPage() {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();
  const assets = userId ? await getCardBankAssetsForUser(userId) : [];
  const activeAssets = assets.filter(
    (asset) => asset.status === "stored" || asset.status === "pawned"
  );
  const depositedCards = assets
    .filter((asset) => asset.status === "stored" && asset.intakeMode !== "bulk")
    .map(mapBankCard);
  const pawnedCards = assets
    .filter((asset) => asset.status === "pawned")
    .map(mapPawnCard);
  const pooledAssets = assets
    .filter((asset) => asset.intakeMode === "bulk" && (asset.status === "stored" || asset.status === "pawned"))
    .map(mapBulkPool);
  const hasBankCards = depositedCards.length > 0;
  const hasPawnCards = pawnedCards.length > 0;
  const hasPooledAssets = pooledAssets.length > 0;
  const depositedQuantity = depositedCards.reduce((sum, card) => sum + card.quantity, 0);
  const pawnedQuantity = pawnedCards.reduce((sum, card) => sum + card.quantity, 0);
  const totalNexValue = activeAssets.reduce(
    (sum, asset) => sum + asset.nexValue * Math.max(1, asset.quantity),
    0
  );
  const totalCoinValue = activeAssets.reduce(
    (sum, asset) => sum + asset.coinValue * Math.max(1, asset.quantity),
    0
  );
  const tierCounts = activeAssets.reduce(
    (summary, asset) => {
      if (asset.assetTier === "bronze" || asset.assetTier === "silver" || asset.assetTier === "gold") {
        summary[asset.assetTier] += Math.max(1, asset.quantity);
      } else if (asset.assetTier === "unknown") {
        summary.unknown += Math.max(1, asset.quantity);
      }
      return summary;
    },
    { bronze: 0, silver: 0, gold: 0, unknown: 0 }
  );
  const assetsVersion = getCardBankAssetsVersion(assets);

  return (
    <div className="min-h-full space-y-4 text-white sm:space-y-5">
      <CardBankRealtimeRefresh initialVersion={assetsVersion} />
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#f8fafc_0%,#d4d4d8_36%,#09090b_37%,#030303_100%)] p-[1px] shadow-[0_24px_100px_rgba(0,0,0,0.52)]">
        <div className="rounded-[27px] bg-[radial-gradient(circle_at_16%_18%,rgba(255,255,255,0.16),transparent_28%),linear-gradient(135deg,#101113_0%,#050506_62%,#000_100%)] p-4 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.06] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-white/72">
                <Landmark className="h-3.5 w-3.5" />
                Card Bank & Pawn Desk
              </div>
              <h1 className="mt-4 text-3xl font-black leading-tight text-white sm:text-5xl">
                ธนาคารการ์ด
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/64 sm:text-base">
                ศูนย์จัดการการ์ดจริงของลูกค้า สำหรับฝาก ตรวจสอบ โยกย้าย
                แปลงเป็น NEX / COIN และนำการ์ดที่ฝากแล้วเข้าโหมดรับฝากการ์ด
                ด้วยกติกาที่ชัดเจนและตรวจสอบได้
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
              <Metric label="ทรัพย์สินรวม" value={`${totalNexValue.toLocaleString("th-TH")} NEX`} />
              <Metric label="COIN รวม" value={totalCoinValue.toLocaleString("th-TH")} />
              <Metric label="สถานะข้อมูล" value={hasBankCards || hasPooledAssets ? "พร้อมใช้งาน" : "ยังว่าง"} />
            </div>
          </div>
        </div>
      </section>

      {!hasBankCards && !hasPawnCards && !hasPooledAssets ? (
        <EmptyBankNotice />
      ) : (
        <div className="space-y-4">
          <AssetSummaryPanel
            totalNexValue={totalNexValue}
            totalCoinValue={totalCoinValue}
            depositedQuantity={depositedQuantity}
            pawnedQuantity={pawnedQuantity}
            tierCounts={tierCounts}
          />
          {hasPooledAssets ? <BulkPoolView pools={pooledAssets} /> : null}
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
            <CardList title="การ์ดที่ฝากในธนาคาร" cards={depositedCards} />
            <PawnList cards={pawnedCards} />
          </section>
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        <ModePanel
          title="โหมดธนาคารการ์ด"
          subtitle="ฝากสินทรัพย์จริงไว้กับบริษัท"
          icon={Landmark}
          items={bankTerms}
          action="ยังไม่มีการ์ดให้จัดการ"
        />
        <ModePanel
          title="โหมดรับฝากการ์ด"
          subtitle="ใช้การ์ดในธนาคารเป็นหลักประกัน"
          icon={Banknote}
          items={pawnTerms}
          action="ต้องมีการ์ดในธนาคารก่อน"
        />
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">
              Customer Flow
            </div>
            <h2 className="mt-2 text-2xl font-black text-white">
              ขั้นตอนการใช้งานที่ลูกค้าจะเห็น
            </h2>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/55">
            ไม่มีการ์ด = อ่านเงื่อนไขอย่างเดียว
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {processSteps.map((step) => (
            <StepCard key={step.title} {...step} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[28px] border border-white/10 bg-[#050505] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/12 bg-white/[0.055]">
              <CalendarClock className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">ตารางกำหนดชำระ</h2>
              <p className="mt-2 text-sm leading-7 text-white/58">
                ค่าฝากธนาคารและดอกเบี้ยรับฝากเป็นคนละรายการ ระบบควรออกบิลแยก
                พร้อมวันครบกำหนด สถานะล่าช้า และประวัติการชำระครบทุกเดือน
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <RuleLine label="ค่าฝากรายเดือน" value="กำหนดเรทในหลังบ้าน" />
            <RuleLine label="เพดานรับยอด" value="ไม่เกิน 80% ของมูลค่าจริง" />
            <RuleLine label="ดอกเบี้ยรับฝาก" value="5% ต่อเดือนของเงินต้น" />
            <RuleLine label="ค่ารักษา" value="200 บาทต่อรายการ" />
            <RuleLine label="ครบกำหนด" value="วันเดียวกับวันที่เข้าโหมดรับฝากของทุกเดือน" />
            <RuleLine label="หลุดถาวร" value="เกินกำหนดชำระมากกว่า 7 วัน" danger />
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/12 bg-white/[0.055]">
              <LockKeyhole className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">กติกาป้องกันความผิดพลาด</h2>
              <p className="mt-2 text-sm leading-7 text-white/58">
                ทุกการโยกย้ายต้องมี log: ผู้ทำรายการ เวลา มูลค่าเดิม มูลค่าใหม่
                สถานะก่อน/หลัง และเหตุผล เพื่อให้ลูกค้าและแอดมินตรวจย้อนหลังได้
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SafetyCard icon={ReceiptText} title="ใบรับฝาก" desc="ผูกกับเจ้าของ การ์ด รูปหลักฐาน serial และวันที่รับเข้า" />
            <SafetyCard icon={CircleDollarSign} title="มูลค่าการ์ด" desc="ใช้เป็นฐานคิด NEX / COIN / เงินสด และดอกเบี้ยรับฝาก" />
            <SafetyCard icon={AlertTriangle} title="สถานะหลุด" desc="เกิน 7 วันต้องล็อกถาวร ถอนหรือย้ายกลับไม่ได้" />
            <SafetyCard icon={FileText} title="Audit Log" desc="บันทึกทุก action เพื่อกันข้อมูลคลาดเคลื่อน" />
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyBankNotice() {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#0b0b0c,#030303)] p-5 text-center shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:p-8">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/12 bg-white/[0.055] text-white">
        <WalletCards className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-2xl font-black text-white sm:text-3xl">
        ยังไม่มีการ์ดระบบธนาคารของท่าน
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/58 sm:text-base">
        เมื่อท่านนำการ์ดจริงมาฝากกับบริษัท และแอดมินตรวจสอบพร้อมคีย์เข้าหลังบ้านแล้ว
        รายการการ์ดของท่านจะแสดงในหน้านี้แบบเรียลไทม์
      </p>
      <div className="mx-auto mt-5 grid max-w-4xl gap-3 text-left md:grid-cols-3">
        <InfoPill title="ยังจัดการไม่ได้" desc="ยังไม่มีการ์ดให้ถอน แปลง หรือรับฝาก" />
        <InfoPill title="อ่านเงื่อนไขก่อน" desc="ดูค่าฝาก ดอกเบี้ย และกติกาหลุดถาวรได้ด้านล่าง" />
        <InfoPill title="รอหลังบ้านยืนยัน" desc="ข้อมูลจะขึ้นเมื่อแอดมินคีย์การ์ดเข้าระบบแล้ว" />
      </div>
    </section>
  );
}

function AssetSummaryPanel({
  totalNexValue,
  totalCoinValue,
  depositedQuantity,
  pawnedQuantity,
  tierCounts,
}: {
  totalNexValue: number;
  totalCoinValue: number;
  depositedQuantity: number;
  pawnedQuantity: number;
  tierCounts: { bronze: number; silver: number; gold: number; unknown: number };
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#18181b,#050505_70%,#000)] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.38)] sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">
            Asset Summary
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">สรุปทรัพย์สินในธนาคารการ์ด</h2>
        </div>
        <div className="rounded-full border border-emerald-300/18 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-100">
          {totalNexValue.toLocaleString("th-TH")} NEX ทั้งหมด
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="มูลค่าทรัพย์สินรวม" value={`${totalNexValue.toLocaleString("th-TH")} NEX`} />
        <Metric label="COIN รวม" value={totalCoinValue.toLocaleString("th-TH")} />
        <Metric label="อยู่ในธนาคาร" value={`${depositedQuantity.toLocaleString("th-TH")} ใบ/ชุด/กอง`} />
        <Metric label="อยู่ในรับฝากการ์ด" value={`${pawnedQuantity.toLocaleString("th-TH")} ใบ/ชุด/กอง`} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <TierCountCard label="Bronze" value={tierCounts.bronze} tone="bronze" />
        <TierCountCard label="Silver" value={tierCounts.silver} tone="silver" />
        <TierCountCard label="Gold" value={tierCounts.gold} tone="gold" />
        <TierCountCard label="UNKNOWN" value={tierCounts.unknown} tone="unknown" />
      </div>
    </section>
  );
}

function TierCountCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "bronze" | "silver" | "gold" | "unknown";
}) {
  const toneClass =
    tone === "gold"
      ? "border-amber-200/20 bg-amber-300/10 text-amber-100"
      : tone === "silver"
        ? "border-zinc-200/20 bg-zinc-200/10 text-zinc-100"
        : tone === "unknown"
          ? "border-sky-200/20 bg-sky-400/10 text-sky-100"
          : "border-orange-200/20 bg-orange-400/10 text-orange-100";

  return (
    <div className={`rounded-[20px] border p-4 ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">
        {label}
      </div>
      <div className="mt-2 text-3xl font-black">{value.toLocaleString("th-TH")}</div>
      <div className="mt-1 text-xs font-bold opacity-70">ใบ/กองที่นับเป็นหมวด {label}</div>
    </div>
  );
}

function CardList({ title, cards }: { title: string; cards: BankCard[] }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
      <h2 className="text-xl font-black text-white">{title}</h2>
      <div className="mt-4 space-y-3">
        {cards.map((card) => (
          <div key={card.id} className="rounded-[20px] border border-white/10 bg-black/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white/56">
                    {card.intakeMode === "sets" ? "SET" : card.cardNo}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/24 px-3 py-1 text-[11px] font-black text-white/48">
                    คงเหลือ {card.quantity.toLocaleString("th-TH")}
                  </span>
                </div>
                <div className="mt-1 text-lg font-black text-white">{card.name}</div>
                <div className="mt-1 text-sm text-white/52">{card.tier}</div>
                {card.intakeMode === "sets" ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-white/52">
                    <span className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1">
                      {card.setCardTotal || 0} ใบต่อเซ็ต
                    </span>
                    <span className="rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1 text-emerald-100/80">
                      {card.nexValue.toLocaleString("th-TH")} NEX ต่อเซ็ต
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="text-left sm:text-right">
                <div className="text-lg font-black text-white">
                  {card.intakeMode === "sets"
                    ? `${(card.nexValue * card.quantity).toLocaleString("th-TH")} NEX`
                    : formatTHB(card.valueTHB)}
                </div>
                <div className="mt-1 text-xs text-white/45">ค่าฝากถัดไป {card.nextFeeDate}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PawnList({ cards }: { cards: PawnCard[] }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
      <h2 className="text-xl font-black text-white">รายการรับฝากการ์ด</h2>
      <div className="mt-4 space-y-3">
        {cards.map((card) => (
          <div key={card.id} className="rounded-[20px] border border-white/10 bg-black/30 p-4">
            <div className="font-black text-white">{card.name}</div>
            <div className="mt-2 grid gap-2 text-sm text-white/58">
              <RuleLine label="ดอกเบี้ยเดือนนี้" value={formatTHB(card.monthlyInterestTHB)} />
              <RuleLine label="ครบกำหนด" value={card.interestDueDate} />
              <RuleLine label="ล่าช้า" value={`${card.lateDays} วัน`} danger={card.lateDays > 7} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BulkPoolView({ pools }: { pools: BulkAssetPool[] }) {
  const totalNex = pools.reduce((sum, pool) => sum + pool.nexBalance, 0);
  const totalCoin = pools.reduce((sum, pool) => sum + pool.coinBalance, 0);
  const totalPiles = pools.reduce((sum, pool) => sum + pool.pileCount, 0);

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#f4f4f5_0%,#111_28%,#030303_100%)] p-[1px] shadow-[0_20px_80px_rgba(0,0,0,0.38)]">
      <div className="rounded-[27px] bg-[radial-gradient(circle_at_12%_16%,rgba(255,255,255,0.14),transparent_24%),linear-gradient(135deg,#101010,#050505_70%,#000)] p-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(380px,1.05fr)]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.055] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-white/55">
              <Layers3 className="h-3.5 w-3.5" />
              Bulk Card Pool
            </div>
            <h2 className="mt-4 text-2xl font-black text-white sm:text-3xl">
              กอง NEX / COIN แบบรวม
            </h2>
            <p className="mt-3 text-sm leading-7 text-white/58">
              รายการนี้แอดมินคีย์เป็นยอดรวม ถ้าเป็น NEX เพียวจะไม่แสดงชนิดการ์ด
              ถ้าเลือก Bronze / Silver / Gold ระบบจะนับเข้าหมวดนั้นในสรุปด้านบน
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric label="กองการ์ด" value={`${totalPiles.toLocaleString("th-TH")} กอง`} />
              <Metric label="NEX รวม" value={totalNex.toLocaleString("th-TH")} />
              <Metric label="COIN รวม" value={totalCoin.toLocaleString("th-TH")} />
            </div>
          </div>

          <div className="relative min-h-[260px] overflow-hidden rounded-[24px] border border-white/10 bg-black/30 p-5">
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_35%,rgba(255,255,255,0.04))]" />
            <div className="relative flex min-h-[220px] items-center justify-center">
              <div className="relative h-[168px] w-[230px]">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div
                    key={index}
                    className="absolute left-1/2 top-1/2 h-[138px] w-[96px] rounded-[16px] border border-white/16 bg-[linear-gradient(160deg,#f7f7f7,#232323_34%,#050505_100%)] shadow-[0_18px_45px_rgba(0,0,0,0.55)]"
                    style={{
                      transform: `translate(-50%, -50%) translateX(${(index - 3) * 18}px) rotate(${(index - 3) * 7}deg)`,
                      opacity: 1 - index * 0.04,
                    }}
                  >
                    <div className="m-3 h-8 rounded-full border border-white/12 bg-white/[0.06]" />
                    <div className="mx-3 mt-4 h-16 rounded-[12px] border border-white/10 bg-black/35" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {pools.map((pool) => (
            <div key={pool.id} className="rounded-[20px] border border-white/10 bg-black/26 p-4">
              <div className="font-black text-white">{pool.label}</div>
              <div className="mt-1 text-xs font-bold text-white/42">
                {pool.category === "pure"
                  ? "ยอดรวมเพียว ไม่ระบุรายการการ์ด"
                  : pool.category === "unknown"
                    ? "นับเป็นหมวด UNKNOWN"
                    : `นับเป็นหมวด ${pool.category.toUpperCase()}`}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <RuleLine label="NEX" value={pool.nexBalance.toLocaleString("th-TH")} />
                <RuleLine label="COIN" value={pool.coinBalance.toLocaleString("th-TH")} />
              </div>
              <div className="mt-3 text-xs font-bold text-white/42">
                อัพเดทล่าสุด {pool.updatedAt}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ModePanel({
  title,
  subtitle,
  icon: Icon,
  items,
  action,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  items: string[];
  action: string;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-white/35">
            {subtitle}
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/12 bg-white/[0.055]">
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item} className="flex gap-3 text-sm leading-7 text-white/62">
            <BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-white/72" />
            <span>{item}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled
        className="mt-5 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white/36"
      >
        {action}
      </button>
    </section>
  );
}

function StepCard({ title, desc, icon: Icon }: { title: string; desc: string; icon: LucideIcon }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.055]">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="mt-4 text-base font-black text-white">{title}</div>
      <div className="mt-2 text-sm leading-6 text-white/55">{desc}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-black/34 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/38">
        {label}
      </div>
      <div className="mt-3 text-xl font-black text-white">{value}</div>
    </div>
  );
}

function InfoPill({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.035] p-4">
      <div className="font-black text-white">{title}</div>
      <div className="mt-2 text-sm leading-6 text-white/52">{desc}</div>
    </div>
  );
}

function RuleLine({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2">
      <span className="text-sm text-white/48">{label}</span>
      <span className={`text-right text-sm font-black ${danger ? "text-red-200" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}

function SafetyCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-black/24 p-4">
      <Icon className="h-5 w-5 text-white/72" />
      <div className="mt-3 font-black text-white">{title}</div>
      <div className="mt-2 text-sm leading-6 text-white/52">{desc}</div>
    </div>
  );
}
