import {
  AlertTriangle,
  ArrowRightLeft,
  BadgeCheck,
  ClipboardCheck,
  Coins,
  DatabaseZap,
  Gem,
  Landmark,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

const intakeQueue = [
  {
    id: "CB-2401",
    user: "NEXORA User 8841",
    card: "No.010 Varek Auron",
    serial: "NX-010-REAL-8841",
    stage: "รอตรวจสภาพ",
    nex: 100000,
    coin: 6200,
  },
  {
    id: "CB-2402",
    user: "NEXORA User 2165",
    card: "No.090 Auralith Warden",
    serial: "NX-090-REAL-2165",
    stage: "พร้อมเข้าธนาคาร",
    nex: 25000,
    coin: 1800,
  },
  {
    id: "CB-2403",
    user: "NEXORA User 4420",
    card: "No.200 Verified Asset",
    serial: "NX-200-REAL-4420",
    stage: "รออนุมัติแปลง",
    nex: 80000,
    coin: 5400,
  },
];

const adminModules = [
  {
    title: "รับฝากการ์ด",
    desc: "บันทึกเจ้าของ, รูปถ่ายหน้า/หลัง, Serial, วันที่รับฝาก, พนักงานรับเรื่อง และใบรับฝาก",
    icon: PackageCheck,
  },
  {
    title: "ตรวจสภาพและยืนยันของจริง",
    desc: "กำหนด grade, เช็กความสมบูรณ์, กันการ์ดซ้ำ, อัปโหลดหลักฐาน และล็อกผู้ตรวจสอบ",
    icon: ClipboardCheck,
  },
  {
    title: "คีย์ฐานข้อมูลธนาคาร",
    desc: "ระบุเลขการ์ด, ประเภท, ระดับ, ธาตุ, NEX value, COIN value, vault slot และสถานะถอนได้",
    icon: DatabaseZap,
  },
  {
    title: "อนุมัติการแปลง",
    desc: "เมื่อลูกค้าแปลงเป็น NEX/COIN ต้องตัดการ์ดออกจากธนาคาร สร้าง point log และ audit log ทันที",
    icon: ArrowRightLeft,
  },
  {
    title: "คำขอถอนการ์ด",
    desc: "จัดการคำขอคืนการ์ดจริง ตรวจเจ้าของ ตรวจสถานะยังไม่ถูกแปลง และบันทึกการส่งมอบ",
    icon: UserCheck,
  },
  {
    title: "Audit และความเสี่ยง",
    desc: "ติดตามทุก movement: deposit, edit, convert, withdraw, void พร้อมเหตุผลและผู้อนุมัติ",
    icon: ShieldCheck,
  },
];

function formatNumber(value: number) {
  return value.toLocaleString("th-TH");
}

export default function AdminCardBankPage() {
  const totalNex = intakeQueue.reduce((sum, item) => sum + item.nex, 0);
  const totalCoin = intakeQueue.reduce((sum, item) => sum + item.coin, 0);

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-amber-200/16 bg-[linear-gradient(135deg,rgba(251,191,36,0.12),rgba(255,255,255,0.04)_36%,rgba(0,0,0,0.38))] p-5 shadow-[0_26px_100px_rgba(0,0,0,0.45)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-black/24 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-amber-100">
              <Landmark className="h-3.5 w-3.5" />
              Admin Card Bank
            </div>
            <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
              หลังบ้านธนาคารการ์ด
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/62">
              ศูนย์ควบคุมการรับฝากการ์ดจริง ตรวจสภาพ คีย์เข้าธนาคาร ประเมิน NEX/COIN และอนุมัติการโยกย้ายสินทรัพย์ด้วย audit trail ครบทุกขั้นตอน
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
            <StatCard label="คิวรอดำเนินการ" value={`${intakeQueue.length} รายการ`} icon={ClipboardCheck} />
            <StatCard label="NEX Exposure" value={formatNumber(totalNex)} icon={Gem} />
            <StatCard label="COIN Exposure" value={formatNumber(totalCoin)} icon={Coins} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
        <div className="rounded-[26px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">
                Custody Queue
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">รายการรับฝากและคำขอแปลง</h2>
            </div>
            <button className="inline-flex items-center justify-center gap-2 rounded-[16px] border border-amber-200/22 bg-amber-300/12 px-4 py-3 text-sm font-black text-amber-100 transition hover:bg-amber-300/18">
              <PackageCheck className="h-4 w-4" />
              เพิ่มรายการรับฝาก
            </button>
          </div>

          <div className="mt-5 overflow-x-auto rounded-[22px] border border-white/8">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[120px_1fr_180px_170px_150px] bg-white/[0.045] px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/42">
                <div>ID</div>
                <div>Asset</div>
                <div>Owner</div>
                <div>Status</div>
                <div className="text-right">Value</div>
              </div>
              {intakeQueue.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[120px_1fr_180px_170px_150px] items-center border-t border-white/8 px-4 py-4 text-sm"
                >
                  <div className="font-black text-amber-200">{item.id}</div>
                  <div className="min-w-0">
                    <div className="truncate font-black text-white">{item.card}</div>
                    <div className="mt-1 truncate text-xs text-white/45">{item.serial}</div>
                  </div>
                  <div className="truncate text-white/70">{item.user}</div>
                  <div>
                    <span className="rounded-full border border-cyan-200/14 bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-100">
                      {item.stage}
                    </span>
                  </div>
                  <div className="text-right text-xs font-bold text-white/60">
                    <div className="text-amber-200">{formatNumber(item.nex)} NEX</div>
                    <div className="mt-1 text-cyan-200">{formatNumber(item.coin)} COIN</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-[26px] border border-red-300/16 bg-red-400/10 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-red-200/18 bg-red-300/10 text-red-100">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-red-50">กฎสำคัญของการแปลง</h2>
                <p className="mt-2 text-sm leading-7 text-red-100/78">
                  เมื่อแปลงการ์ดเป็น NEX หรือ COIN แล้ว ห้ามเปิดคำขอถอนการ์ดใบนั้นอีก ระบบต้องตัดสถานะเป็น converted และสร้าง audit log พร้อมผู้อนุมัติทุกครั้ง
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[26px] border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-xl font-black text-white">ข้อมูลที่หลังบ้านต้องมี</h2>
            <div className="mt-4 grid gap-3">
              {adminModules.map((module) => {
                const Icon = module.icon;
                return (
                  <div key={module.title} className="grid grid-cols-[42px_minmax(0,1fr)] gap-3 rounded-[18px] border border-white/8 bg-black/20 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-amber-200/14 bg-amber-300/10 text-amber-200">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-white">{module.title}</div>
                      <div className="mt-1 text-xs leading-6 text-white/55">{module.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <RequirementCard
          title="Front-end Customer"
          icon={Landmark}
          items={[
            "รายการการ์ดที่ฝากไว้พร้อมรูป, เลขการ์ด, serial, สถานะ และตำแหน่งเก็บ",
            "มูลค่า NEX/COIN แยกต่อใบ พร้อมปุ่มแปลงแต่ละสกุล",
            "คำขอถอนการ์ดจริง เฉพาะใบที่ยังไม่ถูกแปลง",
            "ประวัติ movement และใบรับฝาก/ใบแปลงสินทรัพย์",
          ]}
        />
        <RequirementCard
          title="Admin Operations"
          icon={ShieldCheck}
          items={[
            "สร้างรายการรับฝากและผูก userId/lineId เจ้าของตัวจริง",
            "ตรวจสภาพ grade, รูปหลักฐาน, serial, duplicate protection",
            "กำหนดมูลค่า NEX/COIN และสถานะพร้อมแปลง/ถอนได้/ล็อกตรวจสอบ",
            "อนุมัติ conversion และ withdrawal ด้วย staff role",
          ]}
        />
        <RequirementCard
          title="Ledger & Safety"
          icon={LockKeyhole}
          items={[
            "ตาราง CardBankAsset, CardBankMovement, ConversionRequest",
            "ธุรกรรมแปลงต้อง atomic: update asset + wallet + point log + audit",
            "converted asset ต้องถอนออกไม่ได้ถาวร",
            "ทุก edit ต้องมีเหตุผล, ผู้แก้, เวลา, before/after snapshot",
          ]}
        />
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Landmark;
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-black/26 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/38">
          {label}
        </div>
        <Icon className="h-4 w-4 text-amber-200" />
      </div>
      <div className="mt-3 text-xl font-black text-white">{value}</div>
    </div>
  );
}

function RequirementCard({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof Landmark;
  items: string[];
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-amber-200/14 bg-amber-300/10 text-amber-200">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-black text-white">{title}</h3>
      </div>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-sm leading-6 text-white/62">
            <BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
