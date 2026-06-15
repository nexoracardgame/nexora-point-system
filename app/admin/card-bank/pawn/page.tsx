import {
  BadgeCheck,
  Banknote,
  CircleDollarSign,
  Landmark,
  ReceiptText,
  ShieldCheck,
  TimerReset,
  type LucideIcon,
} from "lucide-react";
import {
  getCardBankPawnAssets,
  type CardBankAsset,
  type CardBankStatus,
} from "@/lib/card-bank-store";
import { getPawnLedgerEntries, type PawnLedgerEntry } from "@/lib/pawn-ledger-sheet";
import CardBankWithdrawPanel from "../CardBankWithdrawPanel";
import PawnNextActions from "./PawnNextActions";

export const dynamic = "force-dynamic";

const fallbackEntries: PawnLedgerEntry[] = [
  {
    rowNumber: 1,
    recordId: "sample-1",
    assetId: "sample-1",
    ownerId: "sample-owner-1",
    ownerLineId: "sample-line-1",
    pledgeDate: "2026-06-15T09:00:00.000Z",
    borrowerName: "ตัวอย่างลูกค้า",
    borrowerContact: "LINE: sample-user",
    cardLabel: "Blue-Eyes White Dragon x1",
    cardCount: 1,
    principalTHB: 12000,
    monthlyInterestRate: 10,
    monthlyInterestTHB: 1200,
    dueDate: "2026-07-15T09:00:00.000Z",
    status: "กำลังใช้งาน",
    note: "ใช้เป็นข้อมูลตัวอย่างก่อนผูกชีตจริง",
    staffName: "NEXORA Admin",
    updatedAt: "2026-06-15T09:30:00.000Z",
  },
  {
    rowNumber: 2,
    recordId: "sample-2",
    assetId: "sample-2",
    ownerId: "sample-owner-2",
    ownerLineId: "sample-line-2",
    pledgeDate: "2026-06-10T09:00:00.000Z",
    borrowerName: "ผู้ฝากรายที่ 2",
    borrowerContact: "089-123-4567",
    cardLabel: "Set Bundle - Foil Pack",
    cardCount: 3,
    principalTHB: 28000,
    monthlyInterestRate: 10,
    monthlyInterestTHB: 2800,
    dueDate: "2026-07-10T09:00:00.000Z",
    status: "ค้างชำระ",
    note: "เตือนชำระก่อนครบกำหนด",
    staffName: "NEXORA Admin",
    updatedAt: "2026-06-14T10:15:00.000Z",
  },
];

function formatThaiDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatThaiDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTHB(value: number) {
  return value.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toLocaleString("th-TH", {
    maximumFractionDigits: 2,
  })}%`;
}

function getStatusTone(status: string) {
  const normalized = String(status || "").trim();
  if (normalized.includes("หลุด")) {
    return "border-red-300/20 bg-red-500/12 text-red-100";
  }
  if (normalized.includes("ค้าง")) {
    return "border-amber-300/20 bg-amber-400/12 text-amber-100";
  }
  if (normalized.includes("ครบ")) {
    return "border-sky-300/20 bg-sky-400/12 text-sky-100";
  }
  if (normalized.includes("ปิด")) {
    return "border-emerald-300/20 bg-emerald-400/12 text-emerald-100";
  }
  return "border-white/10 bg-white/[0.06] text-white/75";
}

function safeDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getOverdueDays(dueDate: string) {
  const date = safeDate(dueDate);
  if (!date) return 0;
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function toDisplayRows(entries: PawnLedgerEntry[]) {
  return entries.map((entry) => ({
    ...entry,
    overdueDays: getOverdueDays(entry.dueDate),
  }));
}

function parseNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function getPawnSource(asset: CardBankAsset) {
  const source =
    asset.sourcePayload && typeof asset.sourcePayload === "object"
      ? asset.sourcePayload
      : null;
  return source && typeof source.pawn === "object"
    ? (source.pawn as Record<string, unknown>)
    : null;
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function getAssetStatusLabel(status: CardBankStatus) {
  if (status === "forfeited") return "ปิดสิทธิ์รับฝาก";
  if (status === "withdrawn" || status === "converted") return "ปิดบัญชี";
  return "กำลังใช้งาน";
}

function getAssetCardLabel(asset: CardBankAsset) {
  if (asset.intakeMode === "sets") {
    return asset.setName || asset.cardName || "Collection Set";
  }

  if (asset.intakeMode === "bulk") {
    const nex = asset.nexValue > 0 ? `${asset.nexValue.toLocaleString("th-TH")} NEX` : "";
    const coin = asset.coinValue > 0 ? `${asset.coinValue.toLocaleString("th-TH")} COIN` : "";
    return ["กองรวม", nex, coin].filter(Boolean).join(" / ");
  }

  return asset.cardNo
    ? `No.${asset.cardNo} ${asset.cardName}`
    : asset.cardName || "Pawned Card";
}

function pawnAssetToLedgerEntry(asset: CardBankAsset, index: number): PawnLedgerEntry {
  const pawn = getPawnSource(asset);
  const principalTHB = Math.max(
    0,
    parseNumber(pawn?.principalTHB ?? asset.valueTHB ?? 0)
  );
  const monthlyInterestRate = Math.max(0, parseNumber(pawn?.interestRate ?? 10));
  const monthlyInterestTHB = Math.max(
    0,
    parseNumber(
      pawn?.monthlyInterestTHB ??
        Math.round(principalTHB * (monthlyInterestRate / 100))
    )
  );
  const dueDays = Math.max(1, Math.floor(parseNumber(pawn?.dueDays ?? 30)) || 30);
  const dueDate = String(pawn?.dueDate || "").trim() || addDays(asset.createdAt, dueDays);

  return {
    rowNumber: index + 1,
    recordId: asset.id,
    assetId: asset.id,
    ownerId: asset.ownerId,
    ownerLineId: asset.ownerLineId || "",
    pledgeDate: asset.createdAt,
    borrowerName: asset.ownerName || "NEXORA Customer",
    borrowerContact: asset.ownerLineId ? `LINE: ${asset.ownerLineId}` : "",
    cardLabel: getAssetCardLabel(asset),
    cardCount: Math.max(1, Math.floor(asset.quantity || 1)),
    principalTHB,
    monthlyInterestRate,
    monthlyInterestTHB,
    dueDate,
    status: getAssetStatusLabel(asset.status),
    note: String(pawn?.note || "").trim(),
    staffName: asset.createdByName || "NEXORA Staff",
    updatedAt: asset.updatedAt || asset.createdAt,
  };
}

function mergeLedgerEntries(
  primaryEntries: PawnLedgerEntry[],
  secondaryEntries: PawnLedgerEntry[]
) {
  const byAssetId = new Map<string, PawnLedgerEntry>();

  [...secondaryEntries, ...primaryEntries].forEach((entry) => {
    const key = String(entry.assetId || entry.recordId || "").trim();
    if (!key) return;
    byAssetId.set(key, entry);
  });

  return Array.from(byAssetId.values())
    .sort((a, b) => String(b.pledgeDate || "").localeCompare(String(a.pledgeDate || "")))
    .map((entry, index) => ({ ...entry, rowNumber: index + 1 }));
}

export default async function PawnLedgerPage() {
  const pawnAssets = await getCardBankPawnAssets();
  const systemEntries = pawnAssets.map(pawnAssetToLedgerEntry);
  let entries = fallbackEntries;
  let sheetEntries: PawnLedgerEntry[] = [];
  let sourceLabel = "ตัวอย่างข้อมูล";

  try {
    sheetEntries = await getPawnLedgerEntries();
    if (sheetEntries.length > 0) {
      entries = sheetEntries;
      sourceLabel = "Google Sheet";
    }
  } catch {
    sourceLabel = "ข้อมูลตัวอย่าง (รอเชื่อมชีต)";
  }

  if (systemEntries.length > 0) {
    entries = mergeLedgerEntries(systemEntries, sheetEntries);
    sourceLabel = sheetEntries.length > 0
      ? "ระบบหลัก + Google Sheet"
      : "ระบบหลัก (รออ่าน Google Sheet)";
  } else if (sheetEntries.length > 0) {
    entries = mergeLedgerEntries([], sheetEntries);
  } else {
    entries = [];
    sourceLabel = "ระบบหลัก";
  }

  const rows = toDisplayRows(entries);
  const totalPrincipal = rows.reduce((sum, row) => sum + row.principalTHB, 0);
  const totalInterest = rows.reduce((sum, row) => sum + row.monthlyInterestTHB, 0);
  const activeCount = rows.filter((row) => row.status.includes("กำลัง") || row.status.includes("ครบ")).length;
  const overdueCount = rows.filter((row) => row.overdueDays > 0 && !row.status.includes("ปิด") && !row.status.includes("หลุด")).length;
  const forfeitedCount = rows.filter((row) => row.status.includes("หลุด")).length;

  return (
    <div className="space-y-5 text-white">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#f7f2e8_0%,#d8c08b_24%,#121212_25%,#050505_100%)] p-[1px] shadow-[0_26px_110px_rgba(0,0,0,0.55)]">
        <div className="rounded-[27px] bg-[radial-gradient(circle_at_14%_18%,rgba(255,255,255,0.16),transparent_28%),linear-gradient(135deg,#111111_0%,#070707_62%,#000_100%)] p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/16 bg-amber-300/[0.08] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-amber-100/80">
                <Landmark className="h-3.5 w-3.5" />
                Pawn Ledger
              </div>
              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
                ทะเบียนรับฝากการ์ด
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/62">
                หน้านี้ทำเป็น “ส่วนแรก” ของระบบรับฝากการ์ด โดยยึดข้อมูลจาก Google Sheet เป็นหลัก
                เพื่อให้มองภาพรวมได้เร็ว ดูรายการค้างชำระได้ง่าย และต่อยอดไปเป็นระบบรับฝาก/ชำระ/ปิดสิทธิ์ในขั้นถัดไป
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[560px]">
              <SummaryCard label="ยอดเงินต้นรวม" value={formatTHB(totalPrincipal)} icon={CircleDollarSign} />
              <SummaryCard label="ดอกเบี้ย/เดือนรวม" value={formatTHB(totalInterest)} icon={Banknote} />
              <SummaryCard label="รายการใช้งาน" value={`${activeCount.toLocaleString("th-TH")} รายการ`} icon={BadgeCheck} />
              <SummaryCard label="ค้างชำระ" value={`${overdueCount.toLocaleString("th-TH")} รายการ`} icon={TimerReset} />
              <SummaryCard label="ปิดสิทธิ์รับฝาก" value={`${forfeitedCount.toLocaleString("th-TH")} รายการ`} icon={Landmark} />
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">
                Live Table
              </div>
              <h2 className="mt-2 text-2xl font-black">ตารางรับฝากหลัก</h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-bold text-white/55">
              แหล่งข้อมูล: {sourceLabel}
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-[22px] border border-white/10">
            <div className="min-w-[1420px]">
              <div className="grid grid-cols-[88px_180px_220px_280px_110px_150px_150px_170px_130px_220px_150px] bg-white/[0.045] px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/38">
                <div>ลำดับ</div>
                <div>วันรับฝาก</div>
                <div>ชื่อผู้ฝาก</div>
                <div>การ์ดที่รับฝาก</div>
                <div>จำนวน</div>
                <div>เงินต้น</div>
                <div>ดอกเบี้ย</div>
                <div>วันครบกำหนด</div>
                <div>สถานะ</div>
                <div>หมายเหตุ</div>
                <div>อัปเดตล่าสุด</div>
              </div>

              {rows.map((row) => (
                <div
                  key={`${row.rowNumber}-${row.borrowerName}-${row.cardLabel}`}
                  className="grid grid-cols-[88px_180px_220px_280px_110px_150px_150px_170px_130px_220px_150px] items-start gap-0 border-t border-white/8 px-4 py-4 text-sm"
                >
                  <div className="font-black text-white">{row.rowNumber.toLocaleString("th-TH")}</div>
                  <div className="space-y-1 text-white/72">
                    <div className="font-bold text-white">{formatThaiDate(row.pledgeDate)}</div>
                    <div className="text-[11px] text-white/42">
                      {safeDate(row.pledgeDate) ? "รับฝากเรียบร้อย" : "ยังไม่ระบุวันที่"}
                    </div>
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="truncate font-black text-white">{row.borrowerName}</div>
                    <div className="truncate text-xs text-white/45">
                      {row.borrowerContact || "ไม่มีช่องทางติดต่อ"}
                    </div>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="truncate font-bold text-white/90">{row.cardLabel}</div>
                    <div className="text-xs text-white/45">
                      {row.cardCount.toLocaleString("th-TH")} ใบ/ชิ้น
                    </div>
                  </div>
                  <div className="font-black text-white">{row.cardCount.toLocaleString("th-TH")}</div>
                  <div className="font-black text-amber-100">{formatTHB(row.principalTHB)}</div>
                  <div className="space-y-1">
                    <div className="font-black text-white">{formatTHB(row.monthlyInterestTHB)}</div>
                    <div className="text-xs text-white/45">{formatPercent(row.monthlyInterestRate)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-white">{formatThaiDate(row.dueDate)}</div>
                    <div className="text-xs text-white/45">
                      {row.overdueDays > 0 ? `${row.overdueDays.toLocaleString("th-TH")} วันล่าช้า` : "ยังไม่ครบกำหนด"}
                    </div>
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getStatusTone(row.status)}`}>
                      {row.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-white/66">
                    <div className="leading-6">{row.note || "-"}</div>
                    <div className="text-[11px] text-white/38">
                      {row.staffName ? `โดย ${row.staffName}` : "ยังไม่ระบุผู้รับเรื่อง"}
                    </div>
                  </div>
                  <div className="text-white/52">{formatThaiDateTime(row.updatedAt)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden">
          <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/12 bg-white/[0.055]">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black">คอลัมน์สำคัญที่ควรมีในชีต</h2>
                <p className="mt-2 text-sm leading-7 text-white/58">
                  ผมใส่ให้ครบตามที่ใช้งานจริงแล้ว เพื่อให้ชีตอ่านง่ายและต่อยอดเป็น workflow ได้ในรอบถัดไป
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {[
                "ลำดับ / วันที่รับฝาก / ชื่อผู้ฝาก",
                "การ์ดที่รับฝาก / จำนวน / เงินต้น",
                "ดอกเบี้ยรายเดือน / วันครบกำหนด / สถานะ",
                "หมายเหตุ / ผู้รับเรื่อง / อัปเดตล่าสุด",
              ].map((item) => (
                <div key={item} className="flex gap-2 rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-white/68">
                  <BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-200" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#111111,#050505)] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/12 bg-white/[0.055]">
                <ReceiptText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black">โครงสร้างที่แนะนำ</h2>
                <p className="mt-2 text-sm leading-7 text-white/58">
                  ถ้าจะให้ระบบนิ่ง ควรมีสถานะชัด ๆ เช่น กำลังใช้งาน, ค้างชำระ, ปิดบัญชี, ปิดสิทธิ์รับฝาก
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <InfoLine label="คำนวณเงินต้น" value="ใช้ยอดรับฝากเป็นฐาน" />
              <InfoLine label="คิดดอก" value="ดอกเบี้ยรายเดือน 10% หรือค่าที่ตั้งในชีต" />
              <InfoLine label="ครบกำหนด" value="แสดงวันที่หมดอายุ + จำนวนวันที่เลยกำหนด" />
              <InfoLine label="หมายเหตุ" value="ใช้เก็บเงื่อนไขพิเศษ / ข้อมูลติดต่อ / ประวัติ" />
            </div>
          </section>
        </div>
      </section>

      <CardBankWithdrawPanel
        assets={pawnAssets}
        eyebrow="Pawn Return Desk"
        title="เบิก / ถอนการ์ดรับฝากคืนลูกค้า"
        description="เฉพาะรายการรับฝากการ์ด"
      />

      <PawnNextActions assets={pawnAssets} />

      <section className="hidden rounded-[28px] border border-white/10 bg-white/[0.035] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">
              Next Phase
            </div>
            <h2 className="mt-2 text-2xl font-black">ส่วนถัดไปที่ควรต่อ</h2>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/55">
            พร้อมต่อเป็น CRUD / อนุมัติ / ชำระดอกเบี้ย
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <PhaseCard
            title="ฟอร์มรับฝากการ์ด"
            desc="เพิ่มฟอร์มกรอกชื่อผู้ฝาก การ์ด จำนวน เงินต้น และดอกเบี้ยจากหน้าแอดมิน"
          />
          <PhaseCard
            title="ปุ่มชำระ / ต่ออายุ"
            desc="ทำ action สำหรับรับชำระดอกเบี้ย เลื่อนครบกำหนด และบันทึกประวัติ"
          />
          <PhaseCard
            title="สถานะปิดสิทธิ์รับฝาก"
            desc="ล็อกการ์ดที่เกินกำหนดและแสดงผลแยกชัดเจนในตาราง"
          />
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-black/32 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/38">{label}</div>
        <Icon className="h-4 w-4 text-white/72" />
      </div>
      <div className="mt-3 text-xl font-black text-white">{value}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2">
      <span className="text-sm text-white/48">{label}</span>
      <span className="text-right text-sm font-black text-white">{value}</span>
    </div>
  );
}

function PhaseCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
      <div className="font-black text-white">{title}</div>
      <div className="mt-2 text-sm leading-6 text-white/55">{desc}</div>
    </div>
  );
}
