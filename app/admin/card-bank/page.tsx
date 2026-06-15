import {
  AlertTriangle,
  ArrowRightLeft,
  BadgeCheck,
  Banknote,
  CalendarClock,
  ClipboardCheck,
  DatabaseZap,
  FileCheck2,
  FileText,
  Landmark,
  LockKeyhole,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import {
  getCardBankAssetsByEntryMode,
  type CardBankAdminSummary,
  type CardBankAsset,
} from "@/lib/card-bank-store";
import CardBankWithdrawPanel from "./CardBankWithdrawPanel";

export const dynamic = "force-dynamic";

function buildOverview(summary: CardBankAdminSummary) {
  return [
    { label: "รอรับฝาก/ตรวจสภาพ", value: `${summary.pendingCount.toLocaleString("th-TH")} รายการ`, icon: ClipboardCheck },
    { label: "ฝากอยู่ในธนาคาร", value: `${summary.storedQuantity.toLocaleString("th-TH")} ใบ`, icon: Landmark },
    { label: "จำนำแยกเมนู", value: `${summary.pawnedQuantity.toLocaleString("th-TH")} ใบ`, icon: Banknote },
    { label: "เสี่ยงหลุดถาวร", value: `${summary.forfeitedQuantity.toLocaleString("th-TH")} ใบ`, icon: AlertTriangle },
  ];
}

function buildDepositSummary(assets: CardBankAsset[]): CardBankAdminSummary {
  const latestAssets = assets
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 80);

  return {
    pendingCount: assets.filter((asset) => asset.status === "stored" && asset.intakeMode !== "bulk").length,
    storedQuantity: assets
      .filter((asset) => asset.status === "stored")
      .reduce((sum, asset) => sum + asset.quantity, 0),
    pawnedQuantity: 0,
    forfeitedQuantity: assets
      .filter((asset) => asset.status === "forfeited")
      .reduce((sum, asset) => sum + asset.quantity, 0),
    latestAssets,
  };
}

const adminModules = [
  {
    title: "รับฝากการ์ดจริง",
    desc: "สร้างใบรับฝาก ผูก userId / lineId เจ้าของจริง รูปหน้า-หลัง serial สภาพการ์ด และพนักงานผู้รับเรื่อง",
    icon: PackageCheck,
  },
  {
    title: "ตรวจสภาพและประเมินมูลค่า",
    desc: "คีย์ประเภท ระดับ ธาตุ grade มูลค่าเงินบาท มูลค่า NEX / COIN และสถานะว่าสามารถถอน แปลง หรือจำนำได้หรือไม่",
    icon: FileCheck2,
  },
  {
    title: "ค่าฝากรายเดือน",
    desc: "กำหนดเรทค่าฝากแยกจากดอกเบี้ยจำนำ พร้อมรอบบิล วันที่ครบกำหนด และสถานะชำระของลูกค้าแต่ละคน",
    icon: ReceiptText,
  },
  {
    title: "คำขอเข้าระบบจำนำ",
    desc: "อนุมัติการย้ายการ์ดจากธนาคารไปโหมดจำนำ คำนวณเงินสด ดอกเบี้ย 10% และวันครบกำหนดรายเดือนอัตโนมัติ",
    icon: Banknote,
  },
  {
    title: "ปฏิทินดอกเบี้ย",
    desc: "ติดตามครบกำหนด ฟรี 3 วันแรก แจ้งเตือนช่วงล่าช้า และล็อกสถานะหลุดถาวรเมื่อเกิน 7 วัน",
    icon: CalendarClock,
  },
  {
    title: "Audit Ledger",
    desc: "ทุกการรับฝาก แก้ไข โยกย้าย แปลง ถอน จำนำ ชำระ หรือหลุดถาวรต้องมี before/after snapshot และผู้อนุมัติ",
    icon: ShieldCheck,
  },
];

const queues = [
  {
    lane: "Deposit Intake",
    title: "รอลูกค้านำการ์ดจริงเข้าบริษัท",
    status: "ยังไม่มีรายการ",
    detail: "เมื่อรับการ์ดจริงแล้ว แอดมินต้องคีย์การ์ดก่อน หน้าลูกค้าจึงจะแสดงข้อมูล",
  },
  {
    lane: "Storage Billing",
    title: "รอบบิลค่าฝากธนาคาร",
    status: "รอกำหนดเรท",
    detail: "ค่าฝากเป็นคนละระบบกับดอกจำนำ ต้องเลือกเรทตามประเภท/มูลค่าการ์ด",
  },
  {
    lane: "Pawn Desk",
    title: "คำขอจำนำจากการ์ดที่ฝากอยู่",
    status: "ยังไม่มีคำขอ",
    detail: "คิดดอก 10% ต่อเดือนจากมูลค่าการ์ด ครบกำหนดทุกเดือนตามวันที่เข้าโหมดจำนำ",
  },
  {
    lane: "Forfeit Lock",
    title: "รายการเกิน 7 วัน",
    status: "ปลอดภัย",
    detail: "หากเกิน 7 วันต้องล็อกถาวร ถอน ย้ายกลับ หรือไถ่ถอนไม่ได้",
  },
];

const schemaItems = [
  "CardBankAsset: เจ้าของ, เลขการ์ด, serial, รูปหลักฐาน, grade, vault slot, valueTHB, nexValue, coinValue, status",
  "CardBankMovement: deposit, edit, convert, withdraw, pawn_start, pawn_redeem, forfeit พร้อม before/after",
  "StorageBilling: เรทค่าฝาก, รอบบิล, วันครบกำหนด, สถานะชำระ, ใบเสร็จ",
  "PawnLoan: assetId, principal, monthlyInterest 10%, startedAt, dueDate, lateDays, status",
  "PaymentLedger: แยก storage fee, pawn interest, penalty, wallet/NEX/COIN movement",
  "AdminAuditLog: staffId, role, reason, IP/device, snapshot ก่อนและหลังทุก action",
];

const auditLogRows = [
  {
    event: "Deposit Created",
    scope: "Card Bank",
    detail: "รับฝากการ์ด, userId, lineId, cardNo/finish/quantity, รูปหลักฐาน, staffId, timestamp",
  },
  {
    event: "Finish Locked",
    scope: "Forced Foil",
    detail: "เลขฟอยล์เวอร์ชั่นเก่าต้องบันทึกว่า forced foil และห้ามแก้เป็น normal",
  },
  {
    event: "Bulk Pool Created",
    scope: "NEX / COIN Pool",
    detail: "ยอดรวม NEX/COIN, คำยืนยันลูกค้า, เหตุผลแอดมิน, ห้ามผูกเลขการ์ดรายใบ",
  },
  {
    event: "Pawn Started",
    scope: "Pawn Desk",
    detail: "assetId, มูลค่าหลักประกัน, ดอก 10%, dueDate, grace window, ผู้อนุมัติ",
  },
  {
    event: "Payment / Overdue",
    scope: "Billing",
    detail: "รอบบิล, วันชำระ, lateDays, ฟรี 3 วันแรก, เกิน 7 วันเข้าสถานะ forfeit",
  },
  {
    event: "Forfeit / Convert",
    scope: "Permanent Lock",
    detail: "ล็อกถาวรหลังหลุดหรือแปลงเป็น NEX/COIN พร้อม before/after snapshot",
  },
];

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminCardBankPage() {
  const depositAssets = await getCardBankAssetsByEntryMode("bank");
  const summary = buildDepositSummary(depositAssets);
  const overview = buildOverview(summary);

  return (
    <div className="space-y-5 text-white">
      <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#f5f5f5_0%,#cfcfcf_30%,#111_31%,#030303_100%)] p-[1px] shadow-[0_28px_110px_rgba(0,0,0,0.52)]">
        <div className="rounded-[27px] bg-[radial-gradient(circle_at_10%_18%,rgba(255,255,255,0.18),transparent_26%),linear-gradient(135deg,#101113,#050506_68%,#000)] p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.06] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-white/70">
                <Landmark className="h-3.5 w-3.5" />
                Admin Card Bank
              </div>
              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
                หลังบ้านรับฝากการ์ด
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/62">
                ศูนย์ควบคุมการ์ดจริงของลูกค้า ตั้งแต่รับฝาก ตรวจสภาพ คิดค่าฝาก
                เบิกถอนคืนลูกค้า และแยกงานจำนำไปเมนูจำนำการ์ดโดยเฉพาะ
                โดยทุกขั้นตอนต้องตรวจสอบย้อนหลังได้
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[560px]">
              {overview.map((item) => (
                <OverviewCard key={item.label} {...item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">
                Operating Desk
              </div>
              <h2 className="mt-2 text-2xl font-black">เมนูทำงานของแอดมิน</h2>
            </div>
            <Link
              href="/admin/card-bank/create"
              className="rounded-[18px] border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-black text-white transition hover:bg-white/[0.09]"
            >
              เพิ่มรายการรับฝาก
            </Link>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {adminModules
              .filter((module) => !["คำขอเข้าระบบจำนำ", "ปฏิทินดอกเบี้ย"].includes(module.title))
              .map((module) => (
              <AdminModule key={module.title} {...module} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-[28px] border border-red-300/20 bg-red-500/10 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-red-200/20 bg-red-200/10 text-red-100">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-red-50">กติกาห้ามพลาด</h2>
                <p className="mt-2 text-sm leading-7 text-red-100/78">
                  การ์ดที่ถูกแปลงเป็น NEX / COIN หรือหลุดจำนำเกิน 7 วัน
                  ต้องถูกตัดสิทธิ์ไถ่ถอนถาวร และระบบต้องล็อกไม่ให้แอดมินเผลอย้ายกลับ
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-xl font-black">สูตรคำนวณระบบจำนำ</h2>
            <div className="mt-4 space-y-3">
              <RuleLine label="ฐานมูลค่า" value="valueTHB ของการ์ด" />
              <RuleLine label="ดอกเบี้ยรายเดือน" value="10%" />
              <RuleLine label="ฟรีค่าปรับ" value="1-3 วันแรก" />
              <RuleLine label="ล่าช้าสูงสุด" value="ไม่เกิน 7 วัน" />
              <RuleLine label="เกิน 7 วัน" value="หลุดถาวร" danger />
            </div>
          </section>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">
              Live Queues
            </div>
            <h2 className="mt-2 text-2xl font-black">คิวงานและสถานะที่ต้องรองรับ</h2>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/55">
            ข้อมูลจริงจะมาจากฐานข้อมูลหลังบ้าน
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-[22px] border border-white/10">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[170px_1fr_170px_1.4fr] bg-white/[0.045] px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/38">
              <div>Lane</div>
              <div>Task</div>
              <div>Status</div>
              <div>Admin Note</div>
            </div>
            {queues.map((queue) => (
              <div
                key={queue.lane}
                className="grid grid-cols-[170px_1fr_170px_1.4fr] items-center border-t border-white/8 px-4 py-4 text-sm"
              >
                <div className="font-black text-white">{queue.lane}</div>
                <div className="font-bold text-white/82">{queue.title}</div>
                <div>
                  <span className="rounded-full border border-white/12 bg-white/[0.055] px-3 py-1 text-xs font-black text-white/70">
                    {queue.status}
                  </span>
                </div>
                <div className="leading-6 text-white/52">{queue.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">
              Real Assets
            </div>
            <h2 className="mt-2 text-2xl font-black">รายการรับฝากการ์ดล่าสุด</h2>
          </div>
          <Link
            href="/admin/card-bank/create"
            className="rounded-[18px] border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-black text-white transition hover:bg-white/[0.09]"
          >
            คีย์รายการเพิ่ม
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto rounded-[22px] border border-white/10">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-[150px_1.1fr_1fr_140px_130px_150px] bg-white/[0.045] px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/38">
              <div>Mode</div>
              <div>Owner</div>
              <div>Asset</div>
              <div>Qty</div>
              <div>Status</div>
              <div>Created</div>
            </div>
            {summary.latestAssets.length > 0 ? (
              summary.latestAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="grid grid-cols-[150px_1.1fr_1fr_140px_130px_150px] items-center border-t border-white/8 px-4 py-4 text-sm"
                >
                  <div className="font-black text-white">
                    {asset.entryMode === "pawn" ? "Pawn" : "Bank"} / {asset.intakeMode}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-bold text-white/82">{asset.ownerName}</div>
                    <div className="truncate text-xs text-white/38">{asset.ownerLineId || asset.ownerId}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-bold text-white/82">{asset.cardName}</div>
                    <div className="truncate text-xs text-white/38">
                      {asset.cardNo ? `No.${asset.cardNo}` : asset.setName || "Bulk pool"}
                    </div>
                  </div>
                  <div className="font-black text-white">{asset.quantity.toLocaleString("th-TH")}</div>
                  <div>
                    <span className="rounded-full border border-white/12 bg-white/[0.055] px-3 py-1 text-xs font-black text-white/70">
                      {asset.status}
                    </span>
                  </div>
                  <div className="text-white/52">{formatDateTime(asset.createdAt)}</div>
                </div>
              ))
            ) : (
              <div className="border-t border-white/8 px-4 py-5 text-sm font-bold text-white/45">
                ยังไม่มีรายการจริงใน Card Bank
              </div>
            )}
          </div>
        </div>
      </section>

      <CardBankWithdrawPanel
        assets={summary.latestAssets}
        eyebrow="Deposit Return Desk"
        title="เบิก / ถอนการ์ดรับฝากคืนลูกค้า"
        description="เฉพาะรายการรับฝากการ์ด"
      />

      <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#101010,#050505)] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">
              Security Audit
            </div>
            <h2 className="mt-2 text-2xl font-black">Logs ที่ต้องบันทึกแบบละเอียด</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/55">
              ระบบจริงต้องบันทึกทุก movement แบบ immutable audit trail:
              ใครทำ, ทำเมื่อไร, ทำจากเครื่องไหน, ก่อน/หลังเป็นอะไร, เหตุผลคืออะไร
              และ action นี้กระทบธนาคารการ์ด จำนำ หรือกองรวม NEX / COIN อย่างไร
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-black text-white/55">
            Tamper-resistant ledger
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-[22px] border border-white/10">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[180px_160px_1fr] bg-white/[0.045] px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/38">
              <div>Event</div>
              <div>Scope</div>
              <div>Required Payload</div>
            </div>
            {auditLogRows.map((row) => (
              <div
                key={`${row.scope}-${row.event}`}
                className="grid grid-cols-[180px_160px_1fr] items-center border-t border-white/8 px-4 py-4 text-sm"
              >
                <div className="flex items-center gap-2 font-black text-white">
                  <FileText className="h-4 w-4 text-white/52" />
                  {row.event}
                </div>
                <div>
                  <span className="rounded-full border border-white/12 bg-white/[0.055] px-3 py-1 text-xs font-black text-white/64">
                    {row.scope}
                  </span>
                </div>
                <div className="leading-6 text-white/56">{row.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <RequirementCard
          title="หน้าลูกค้า"
          icon={UserCheck}
          items={[
            "ถ้ายังไม่มีการ์ดจากหลังบ้าน ต้องโชว์สถานะว่างและเงื่อนไขเท่านั้น",
            "แสดงการ์ดที่ฝากจริง แยกจากการ์ดที่เข้าโหมดจำนำ",
            "ลูกค้าเห็นค่าฝากรายเดือน ดอกเบี้ย วันครบกำหนด และสถานะล่าช้า",
            "ปุ่มแปลงเป็น NEX / COIN หรือจำนำต้องใช้ได้เฉพาะการ์ดที่มีสิทธิ์",
          ]}
        />
        <RequirementCard
          title="หลังบ้าน"
          icon={DatabaseZap}
          items={[
            "แอดมินคีย์การ์ดเข้าธนาคารก่อน ลูกค้าจึงเห็นข้อมูล",
            "ตั้งเรทค่าฝากธนาคารแยกจากดอกเบี้ยจำนำ",
            "อนุมัติการจำนำและคำนวณวันครบกำหนดอัตโนมัติ",
            "ล็อก converted / forfeited asset ไม่ให้ถอนคืนถาวร",
          ]}
        />
        <RequirementCard
          title="ฐานข้อมูลและความปลอดภัย"
          icon={LockKeyhole}
          items={schemaItems}
        />
      </section>
    </div>
  );
}

function OverviewCard({
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
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/38">
          {label}
        </div>
        <Icon className="h-4 w-4 text-white/72" />
      </div>
      <div className="mt-3 text-xl font-black text-white">{value}</div>
    </div>
  );
}

function AdminModule({
  title,
  desc,
  icon: Icon,
}: {
  title: string;
  desc: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.055]">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="font-black text-white">{title}</div>
          <div className="mt-2 text-sm leading-6 text-white/55">{desc}</div>
        </div>
      </div>
    </div>
  );
}

function RequirementCard({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: LucideIcon;
  items: string[];
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.055]">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <h3 className="text-lg font-black text-white">{title}</h3>
      </div>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-sm leading-6 text-white/62">
            <BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-white/70" />
            <span>{item}</span>
          </div>
        ))}
      </div>
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
