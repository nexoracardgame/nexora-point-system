import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  ArrowRight,
  Coins,
  Eye,
  Gift,
  Gem,
  Layers3,
  QrCode,
  ShieldCheck,
  Sparkles,
  Ticket,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const revalidate = 30;
export const dynamic = "force-dynamic";

type ActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  createdAt: Date;
  tone: "emerald" | "amber" | "cyan" | "white";
};

function safeImage(image?: string | null) {
  const value = String(image || "").trim();
  return value || "/avatar.png";
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("th-TH");
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function timeAgo(value: Date) {
  const diff = Date.now() - value.getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;

  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}

function activityToneClass(tone: ActivityItem["tone"]) {
  switch (tone) {
    case "emerald":
      return "border-emerald-400/15 bg-emerald-400/10 text-emerald-300";
    case "amber":
      return "border-amber-300/15 bg-amber-300/10 text-amber-200";
    case "cyan":
      return "border-cyan-300/15 bg-cyan-300/10 text-cyan-200";
    default:
      return "border-white/10 bg-white/[0.06] text-white/70";
  }
}

export default async function WalletPage() {
  const session = await getServerSession(authOptions);
  const sessionUser = (session?.user ||
    {}) as {
    id?: string;
    lineId?: string;
    name?: string | null;
    image?: string | null;
    nexPoint?: number;
    coin?: number;
  };

  const userId = String(sessionUser.id || "").trim();

  if (!userId) {
    redirect("/login");
  }

  let user:
    | {
        id: string;
        lineId: string;
        name: string | null;
        displayName?: string | null;
        image: string | null;
        nexPoint: number;
        coin: number;
        createdAt: Date;
      }
    | null = null;
  let pointLogs: Array<{
    id: string;
    point: number | null;
    amount: number | null;
    type: string | null;
    createdAt: Date;
  }> = [];
  let coupons: Array<{
    id: string;
    code: string;
    used: boolean;
    createdAt: Date;
    usedAt: Date | null;
    reward: {
      name: string;
      nexCost: number | null;
      coinCost: number | null;
    };
  }> = [];

  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        lineId: true,
        name: true,
        displayName: true,
        image: true,
        nexPoint: true,
        coin: true,
        createdAt: true,
      },
    });

    if (user) {
      [pointLogs, coupons] = await Promise.all([
        prisma.pointLog.findMany({
          where: {
            lineId: user.lineId,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 12,
        }),
        prisma.coupon.findMany({
          where: {
            userId: user.id,
          },
          include: {
            reward: {
              select: {
                name: true,
                nexCost: true,
                coinCost: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 12,
        }),
      ]);
    }
  } catch {
    user = null;
  }

  const safeUser = user || {
    id: userId,
    lineId: String(sessionUser.lineId || ""),
    name: sessionUser.name || "NEXORA User",
    displayName: sessionUser.name || "NEXORA User",
    image: sessionUser.image || "/avatar.png",
    nexPoint: Number(sessionUser.nexPoint || 0),
    coin: Number(sessionUser.coin || 0),
    createdAt: new Date(),
  };

  const displayName =
    safeUser.displayName || safeUser.name || "ผู้ใช้งาน";
  const nexPoint = Number(safeUser.nexPoint || 0);
  const coin = Number(safeUser.coin || 0);
  const totalEarnedNex = pointLogs.reduce(
    (sum, log) => sum + Number(log.point || 0),
    0
  );
  const totalCardsScanned = pointLogs.reduce(
    (sum, log) => sum + Number(log.amount || 0),
    0
  );
  const activeCoupons = coupons.filter((coupon) => !coupon.used).length;
  const usedCoupons = coupons.filter((coupon) => coupon.used).length;

  const liquidTotal = nexPoint + coin;
  const nexShare = liquidTotal > 0 ? (nexPoint / liquidTotal) * 100 : 0;
  const coinShare = liquidTotal > 0 ? (coin / liquidTotal) * 100 : 0;

  const activities: ActivityItem[] = [
    ...pointLogs.map((log) => ({
      id: `point-${log.id}`,
      title: `ได้รับ ${formatNumber(Number(log.point || 0))} NEX`,
      subtitle: `สแกนการ์ด ${String(log.type || "").toUpperCase()} จำนวน ${formatNumber(
        Number(log.amount || 0)
      )} ใบ`,
      createdAt: log.createdAt,
      tone: "emerald" as const,
    })),
    ...coupons.map((coupon) => ({
      id: `coupon-${coupon.id}`,
      title: coupon.used
        ? `ใช้สิทธิ์ ${coupon.reward.name} แล้ว`
        : `แลกรางวัล ${coupon.reward.name}`,
      subtitle: coupon.used
        ? `ใช้งานเมื่อ ${formatDateTime(coupon.usedAt || coupon.createdAt)}`
        : coupon.reward.nexCost != null
          ? `คูปองพร้อมใช้ ใช้ ${formatNumber(Number(coupon.reward.nexCost))} NEX`
          : coupon.reward.coinCost != null
            ? `คูปองพร้อมใช้ ใช้ ${formatNumber(Number(coupon.reward.coinCost))} COIN`
            : "คูปองพร้อมใช้งาน",
      createdAt: coupon.createdAt,
      tone: coupon.used ? ("white" as const) : ("amber" as const),
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 8);

  const assetCards = [
    {
      id: "nex",
      label: "NEX พร้อมใช้",
      value: `${formatNumber(nexPoint)} NEX`,
      subtitle: `สะสมทั้งหมด ${formatNumber(totalEarnedNex)} NEX`,
      accent:
        "border-violet-400/18 bg-[linear-gradient(180deg,rgba(139,92,246,0.16),rgba(139,92,246,0.06))] text-violet-100",
      icon: Gem,
      valueClass: "text-violet-200",
    },
    {
      id: "coin",
      label: "COIN พร้อมใช้",
      value: `${formatNumber(coin)} COIN`,
      subtitle: "ใช้กับรางวัลที่รองรับ coin ได้ทันที",
      accent:
        "border-emerald-400/18 bg-[linear-gradient(180deg,rgba(16,185,129,0.16),rgba(16,185,129,0.06))] text-emerald-100",
      icon: Coins,
      valueClass: "text-emerald-200",
    },
    {
      id: "coupon",
      label: "คูปองพร้อมใช้",
      value: `${formatNumber(activeCoupons)} ใบ`,
      subtitle: `ใช้แล้ว ${formatNumber(usedCoupons)} ใบ`,
      accent:
        "border-cyan-400/18 bg-[linear-gradient(180deg,rgba(34,211,238,0.16),rgba(34,211,238,0.06))] text-cyan-100",
      icon: Ticket,
      valueClass: "text-cyan-200",
    },
    {
      id: "scan",
      label: "สแกนการ์ดสะสม",
      value: `${formatNumber(totalCardsScanned)} ใบ`,
      subtitle: "กิจกรรมจริงที่บันทึกในระบบทั้งหมด",
      accent:
        "border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] text-white",
      icon: Sparkles,
      valueClass: "text-white",
    },
  ];

  return (
    <div className="min-h-screen bg-[#090909] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.16),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.1),transparent_18%),linear-gradient(180deg,#090909_0%,#0b0b0d_42%,#101119_100%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 xl:px-6">
        <section className="mx-auto max-w-5xl">
          <div className="rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(14,14,16,0.98),rgba(18,18,22,0.94))] p-4 shadow-[0_30px_120px_rgba(0,0,0,0.48)] backdrop-blur-2xl sm:p-6 xl:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-white/38">
                  <Wallet className="h-4 w-4" />
                  Asset Wallet
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl xl:text-5xl">
                    สินทรัพย์ของฉัน
                  </h1>
                  <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/58 sm:inline-flex sm:items-center sm:gap-2">
                    <Eye className="h-4 w-4" />
                    Asset Tracker
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] px-3 py-2 sm:px-4">
                <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-white/10">
                  <Image
                    src={safeImage(safeUser.image)}
                    alt={displayName}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </div>
                <div className="hidden min-w-0 sm:block">
                  <div className="truncate text-sm font-black">{displayName}</div>
                  <div className="text-xs text-white/45">
                    สมาชิกตั้งแต่ {formatDateTime(safeUser.createdAt)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="inline-flex min-h-[42px] items-center rounded-full border border-white/20 bg-black px-4 py-2 text-sm font-black text-white">
                แยกสินทรัพย์
              </div>
              <div className="inline-flex min-h-[42px] items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-bold text-white/45">
                แยกพอร์ต
              </div>
              <div className="mx-1 hidden h-8 w-px bg-white/10 sm:block" />
              <div className="inline-flex min-h-[42px] items-center rounded-full bg-white px-4 py-2 text-sm font-black text-black">
                ทั้งหมด
              </div>
              <div className="inline-flex min-h-[42px] items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-bold text-white/55">
                NEX
              </div>
              <div className="inline-flex min-h-[42px] items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-bold text-white/55">
                COIN
              </div>
              <div className="inline-flex min-h-[42px] items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-bold text-white/55">
                คูปอง
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(135deg,rgba(19,19,19,0.98)_0%,rgba(10,46,27,0.9)_68%,rgba(43,82,35,0.82)_100%)]">
                <div className="flex h-full flex-col justify-between gap-5 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold text-white/82">
                        สินทรัพย์ใน Nexora
                      </div>
                      <div className="mt-1 text-xs text-white/52">
                        รวมยอดที่พร้อมใช้งานตอนนี้
                      </div>
                    </div>
                    <div className="text-right text-xs text-white/56">
                      {formatDateTime(new Date())}
                    </div>
                  </div>

                  <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="text-[40px] font-black tracking-[-0.06em] text-white sm:text-[54px]">
                        {formatNumber(liquidTotal)}
                      </div>
                      <div className="mt-1 text-lg font-bold text-white/84 sm:text-xl">
                        หน่วยที่พร้อมใช้
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <div className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-sm font-black text-emerald-300">
                          NEX {formatNumber(nexPoint)}
                        </div>
                        <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-sm font-black text-cyan-300">
                          COIN {formatNumber(coin)}
                        </div>
                        <div className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-sm font-black text-white/85">
                          คูปอง {formatNumber(activeCoupons)} ใบ
                        </div>
                      </div>
                    </div>

                    <div className="relative h-[130px] w-full max-w-[240px] self-end sm:h-[150px]">
                      <div className="absolute -right-2 top-3 h-16 w-16 rounded-full bg-emerald-400/20 blur-2xl" />
                      <div className="absolute left-4 top-0 h-14 w-14 rounded-full border border-violet-300/30 bg-violet-300/30 shadow-[0_0_45px_rgba(168,85,247,0.45)]" />
                      <div className="absolute left-12 top-10 h-14 w-14 rounded-full border border-violet-200/20 bg-violet-200/20 shadow-[0_0_45px_rgba(196,181,253,0.26)]" />
                      <div className="absolute left-24 top-2 h-12 w-12 rounded-full border border-violet-300/25 bg-violet-300/25 shadow-[0_0_40px_rgba(139,92,246,0.32)]" />
                      <div className="absolute bottom-1 right-4 h-[96px] w-[120px] rounded-[28px] border border-emerald-300/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]" />
                    </div>
                  </div>

                  <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-3 border-t border-white/10 pt-4">
                    <div className="h-12 w-12 rounded-full border-4 border-violet-300" />
                    <div>
                      <div className="text-xl font-black text-white">
                        {nexShare.toFixed(2)}%
                      </div>
                      <div className="text-sm text-white/52">NEX พร้อมใช้</div>
                    </div>
                    <div className="h-3.5 w-3.5 rounded-full bg-emerald-400" />
                    <div>
                      <div className="text-xl font-black text-white">
                        {coinShare.toFixed(2)}%
                      </div>
                      <div className="text-sm text-white/52">COIN พร้อมใช้</div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-white/45" />
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <Link
                  href="/rewards"
                  className="group rounded-[28px] border border-violet-400/15 bg-[linear-gradient(180deg,rgba(28,20,43,0.96),rgba(22,17,34,0.9))] p-5 transition hover:border-violet-300/25"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-2xl font-black">Rewards</div>
                      <div className="mt-2 max-w-[220px] text-sm leading-6 text-white/54">
                        ใช้ NEX หรือ COIN แลกรางวัลใหม่ได้ทันทีจากหน้านี้
                      </div>
                    </div>
                    <div className="rounded-2xl bg-violet-300/14 p-3 text-violet-200">
                      <Gift className="h-6 w-6" />
                    </div>
                  </div>
                </Link>

                <Link
                  href="/redeem"
                  className="group rounded-[28px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(15,22,32,0.96),rgba(11,17,25,0.9))] p-5 transition hover:border-cyan-300/25"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-2xl font-black">Redeem</div>
                      <div className="mt-2 max-w-[220px] text-sm leading-6 text-white/54">
                        เปิดคูปองและ QR เพื่อให้หน้าร้านสแกนใช้งานได้ทันที
                      </div>
                    </div>
                    <div className="rounded-2xl bg-cyan-300/14 p-3 text-cyan-200">
                      <QrCode className="h-6 w-6" />
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-6 grid max-w-5xl gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.26em] text-white/34">
                  ประเภทสินทรัพย์
                </div>
                <h2 className="mt-1 text-2xl font-black sm:text-3xl">
                  ภาพรวมกระเป๋า
                </h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/60">
                <Layers3 className="h-4 w-4" />
                จัดเรียงใหม่
              </div>
            </div>

            <div className="space-y-4">
              {assetCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div
                    key={card.id}
                    className={`rounded-[28px] border p-5 shadow-[0_10px_40px_rgba(0,0,0,0.2)] ${card.accent}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/20">
                          <Icon className="h-7 w-7" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-2xl font-black">{card.label}</div>
                          <div className="mt-1 text-sm text-white/56">
                            {card.subtitle}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`text-right text-2xl font-black sm:text-3xl ${card.valueClass}`}
                      >
                        {card.value}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(20,20,24,0.96),rgba(16,16,20,0.92))] p-5 shadow-[0_16px_60px_rgba(0,0,0,0.3)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.26em] text-white/34">
                    สถานะระบบ
                  </div>
                  <h2 className="mt-1 text-2xl font-black">บัญชีและสิทธิ์</h2>
                </div>
                <div className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-300">
                  เชื่อมต่อแล้ว
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-white/34">
                    ผู้ใช้งาน
                  </div>
                  <div className="mt-2 text-lg font-black">{displayName}</div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-white/34">
                    สมาชิกตั้งแต่
                  </div>
                  <div className="mt-2 text-lg font-black">
                    {formatDateTime(safeUser.createdAt)}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                    ซิงก์กับข้อมูลจริงในระบบ
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/52">
                    หากฐานข้อมูลหลักยังไม่พร้อมใช้งาน หน้านี้จะแสดงข้อมูลจากเซสชันก่อนชั่วคราวเพื่อให้คุณเข้าใช้งานระบบได้ต่อ
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(20,20,24,0.96),rgba(16,16,20,0.92))] p-5 shadow-[0_16px_60px_rgba(0,0,0,0.3)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.26em] text-white/34">
                    รายการล่าสุด
                  </div>
                  <h2 className="mt-1 text-2xl font-black">ความเคลื่อนไหว</h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/55">
                  {activities.length} รายการ
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {activities.length === 0 ? (
                  <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-6 text-center text-white/45">
                    ยังไม่มีความเคลื่อนไหวในกระเป๋าตอนนี้
                  </div>
                ) : (
                  activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-base font-black text-white">
                            {activity.title}
                          </div>
                          <div className="mt-1 text-sm leading-6 text-white/52">
                            {activity.subtitle}
                          </div>
                        </div>

                        <div
                          className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold ${activityToneClass(
                            activity.tone
                          )}`}
                        >
                          {timeAgo(activity.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
