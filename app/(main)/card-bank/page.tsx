import Image from "next/image";
import {
  ArrowRightLeft,
  Coins,
  Gem,
  Landmark,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
  Undo2,
} from "lucide-react";

export const dynamic = "force-dynamic";

const depositedCards = [
  {
    no: "010",
    name: "Varek Auron",
    rarity: "Diamond",
    type: "Monster",
    custody: "Vault A-02",
    serial: "NX-010-REAL-8841",
    nex: 100000,
    coin: 6200,
    status: "พร้อมแปลง",
    image: "/cards/010.jpg",
  },
  {
    no: "090",
    name: "Auralith Warden",
    rarity: "Gold",
    type: "Skill",
    custody: "Vault B-11",
    serial: "NX-090-REAL-2165",
    nex: 25000,
    coin: 1800,
    status: "ถอนได้",
    image: "/cards/090.jpg",
  },
  {
    no: "200",
    name: "No.200 Verified Asset",
    rarity: "Legendary",
    type: "Monster",
    custody: "Vault C-04",
    serial: "NX-200-REAL-4420",
    nex: 80000,
    coin: 5400,
    status: "รออนุมัติ",
    image: "/cards/200.jpg",
  },
];

const workflow = [
  {
    title: "ฝากการ์ดจริง",
    desc: "ลูกค้านำการ์ดตัวจริงให้บริษัทตรวจรับ พร้อมบันทึก Serial, รูป, สภาพ, เจ้าของ และช่องทางติดต่อ",
    icon: PackageCheck,
  },
  {
    title: "คีย์เข้าธนาคาร",
    desc: "แอดมินบันทึกเลขการ์ด ประเภท ระดับ มูลค่า NEX/COIN สถานะถอนได้ และตำแหน่งเก็บจริง",
    icon: Landmark,
  },
  {
    title: "ลูกค้าจัดการเอง",
    desc: "เจ้าของดูสินทรัพย์แบบเรียลไทม์ และเลือกแปลงการ์ดเป็น NEX หรือ COIN ได้จากหน้า PC",
    icon: ArrowRightLeft,
  },
  {
    title: "แลกแล้วล็อกทันที",
    desc: "เมื่อแปลงเป็น NEX/COIN การ์ดใบนั้นถูกตัดออกจากธนาคารและไม่สามารถขอถอนได้อีก",
    icon: LockKeyhole,
  },
];

function formatNumber(value: number) {
  return value.toLocaleString("th-TH");
}

export default function CardBankPage() {
  const totalNex = depositedCards.reduce((sum, card) => sum + card.nex, 0);
  const totalCoin = depositedCards.reduce((sum, card) => sum + card.coin, 0);

  return (
    <>
      <div className="xl:hidden">
        <section className="rounded-[24px] border border-amber-200/14 bg-[#08090d] p-5 text-center shadow-[0_22px_70px_rgba(0,0,0,0.42)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] border border-amber-200/18 bg-amber-300/10 text-amber-200">
            <Landmark className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-black text-white">ธนาคารการ์ด</h1>
          <p className="mt-3 text-sm leading-7 text-white/62">
            เมนูนี้เปิดให้ใช้งานเฉพาะหน้าจอ PC เพื่อให้จัดการสินทรัพย์การ์ดจริงได้แม่นยำและตรวจสอบข้อมูลครบก่อนแปลงเป็น NEX หรือ COIN
          </p>
        </section>
      </div>

      <div className="hidden space-y-5 xl:block">
        <section className="relative overflow-hidden rounded-[30px] border border-amber-200/18 bg-[linear-gradient(135deg,rgba(251,191,36,0.14),rgba(255,255,255,0.045)_34%,rgba(0,0,0,0.42))] p-6 shadow-[0_30px_110px_rgba(0,0,0,0.5)]">
          <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-black/24 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-amber-100">
                <Landmark className="h-3.5 w-3.5" />
                NEXORA Card Bank
              </div>
              <h1 className="mt-4 text-5xl font-black leading-none text-white">
                ธนาคารการ์ด
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/66">
                พื้นที่ตรวจสอบการ์ดจริงที่ฝากไว้กับบริษัท ลูกค้าเห็นรายการสินทรัพย์ สถานะการเก็บรักษา มูลค่า NEX/COIN และเลือกโยกย้ายการ์ดที่ฝากไว้เป็นแต้มได้เองอย่างโปร่งใส
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <StatTile label="การ์ดในธนาคาร" value={`${depositedCards.length} ใบ`} icon={PackageCheck} />
              <StatTile label="มูลค่า NEX พร้อมแปลง" value={formatNumber(totalNex)} icon={Gem} />
              <StatTile label="มูลค่า COIN พร้อมแปลง" value={formatNumber(totalCoin)} icon={Coins} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">
                  Deposited Assets
                </div>
                <h2 className="mt-2 text-2xl font-black text-white">การ์ดที่ฝากไว้</h2>
              </div>
              <div className="rounded-full border border-emerald-300/18 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200">
                Real-time custody view
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {depositedCards.map((card) => (
                <article
                  key={card.serial}
                  className="grid gap-4 rounded-[22px] border border-white/8 bg-black/24 p-4 lg:grid-cols-[88px_minmax(0,1fr)_260px]"
                >
                  <div className="relative aspect-[815/1110] overflow-hidden rounded-[16px] border border-amber-200/14 bg-[#111318]">
                    <Image src={card.image} alt={card.name} fill sizes="88px" className="object-cover" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-amber-200/18 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-200">
                        No.{card.no}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-white/68">
                        {card.rarity} / {card.type}
                      </span>
                      <span className="rounded-full border border-cyan-200/14 bg-cyan-300/10 px-3 py-1 text-xs font-bold text-cyan-100">
                        {card.status}
                      </span>
                    </div>
                    <h3 className="mt-3 text-xl font-black text-white">{card.name}</h3>
                    <div className="mt-3 grid gap-2 text-sm text-white/62 sm:grid-cols-2">
                      <div>Serial: <span className="font-bold text-white/82">{card.serial}</span></div>
                      <div>ตำแหน่งเก็บ: <span className="font-bold text-white/82">{card.custody}</span></div>
                      <div>NEX Value: <span className="font-black text-amber-200">{formatNumber(card.nex)}</span></div>
                      <div>COIN Value: <span className="font-black text-cyan-200">{formatNumber(card.coin)}</span></div>
                    </div>
                  </div>

                  <div className="grid content-center gap-2">
                    <button className="inline-flex items-center justify-center gap-2 rounded-[16px] border border-amber-200/22 bg-amber-300/12 px-4 py-3 text-sm font-black text-amber-100 transition hover:bg-amber-300/18">
                      <Gem className="h-4 w-4" />
                      แปลงเป็น NEX
                    </button>
                    <button className="inline-flex items-center justify-center gap-2 rounded-[16px] border border-cyan-200/18 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/16">
                      <Coins className="h-4 w-4" />
                      แปลงเป็น COIN
                    </button>
                    <button className="inline-flex items-center justify-center gap-2 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white/70 transition hover:bg-white/[0.07]">
                      <Undo2 className="h-4 w-4" />
                      ขอถอนการ์ด
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <section className="rounded-[26px] border border-amber-200/14 bg-[#0b0d10] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-amber-200/16 bg-amber-300/10 text-amber-200">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-white/35">
                    Conversion Rule
                  </div>
                  <h2 className="text-xl font-black text-white">กติกาแปลงสินทรัพย์</h2>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-white/66">
                <p>การ์ดที่ยังอยู่ในธนาคารสามารถขอถอนได้ตามสถานะการตรวจรับและเงื่อนไขบริษัท</p>
                <p className="rounded-[18px] border border-red-300/16 bg-red-400/10 p-4 font-bold text-red-100">
                  หากแปลงเป็น NEX หรือ COIN แล้ว การ์ดใบนั้นจะถูกตัดออกจากธนาคารทันที และไม่สามารถไถ่ถอนกลับเป็นการ์ดจริงได้
                </p>
              </div>
            </section>

            <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
              <h2 className="text-xl font-black text-white">Flow มาตรฐาน</h2>
              <div className="mt-4 grid gap-3">
                {workflow.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.title} className="grid grid-cols-[42px_minmax(0,1fr)] gap-3 rounded-[18px] border border-white/8 bg-black/20 p-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-amber-200/14 bg-amber-300/10 text-amber-200">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-white">{index + 1}. {step.title}</div>
                        <div className="mt-1 text-xs leading-6 text-white/55">{step.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </section>
      </div>
    </>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Landmark;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/28 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/38">
          {label}
        </div>
        <Icon className="h-4 w-4 text-amber-200" />
      </div>
      <div className="mt-3 text-2xl font-black text-white">{value}</div>
    </div>
  );
}
