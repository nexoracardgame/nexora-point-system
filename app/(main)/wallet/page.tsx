import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  Coins,
  Gift,
  Gem,
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

  const spentNexFromCoupons = coupons.reduce(
    (sum, coupon) => sum + Number(coupon.reward.nexCost || 0),
    0
  );
  const spentCoinFromCoupons = coupons.reduce(
    (sum, coupon) => sum + Number(coupon.reward.coinCost || 0),
    0
  );
  const liquidTotal = nexPoint + coin;
  const lifetimeNex = Math.max(
    totalEarnedNex,
    nexPoint + spentNexFromCoupons
  );
  const lifetimeCoin = coin + spentCoinFromCoupons;
  const walletRank =
    lifetimeNex >= 10_000_000
      ? "Challenger"
      : lifetimeNex >= 5_000_000
        ? "Grandmaster"
        : lifetimeNex >= 1_000_000
          ? "Master"
          : lifetimeNex >= 500_000
            ? "Diamond"
            : lifetimeNex >= 300_000
              ? "Emerald"
              : lifetimeNex >= 100_000
                ? "Platinum"
                : lifetimeNex >= 50_000
                  ? "Gold"
                  : lifetimeNex >= 10_000
                    ? "Silver"
                    : lifetimeNex >= 5_000
                      ? "Bronze"
                      : lifetimeNex >= 1_000
                        ? "Iron"
                        : "Rookie";
  const rankStyle =
    walletRank === "Challenger"
      ? {
          shell:
            "border-fuchsia-200/35 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.42),transparent_25%),linear-gradient(135deg,#f0abfc,#f43f5e,#facc15)] text-white shadow-[0_0_42px_rgba(217,70,239,0.42)]",
          icon: "bg-[linear-gradient(135deg,#f0abfc,#facc15,#67e8f9)] text-black shadow-[0_0_42px_rgba(250,204,21,0.45)]",
          glow: "from-fuchsia-400 via-rose-400 to-amber-200",
        }
      : walletRank === "Grandmaster"
        ? {
            shell:
              "border-violet-200/32 bg-[linear-gradient(135deg,#7c3aed,#db2777,#f97316)] text-white shadow-[0_0_38px_rgba(168,85,247,0.36)]",
            icon: "bg-[linear-gradient(135deg,#8b5cf6,#ec4899)] text-white shadow-[0_0_36px_rgba(236,72,153,0.38)]",
            glow: "from-violet-400 via-pink-400 to-orange-300",
          }
        : walletRank === "Master"
          ? {
              shell:
                "border-rose-200/28 bg-[linear-gradient(135deg,#be123c,#7f1d1d,#f59e0b)] text-white shadow-[0_0_34px_rgba(244,63,94,0.32)]",
              icon: "bg-[linear-gradient(135deg,#ef4444,#f59e0b)] text-white shadow-[0_0_34px_rgba(245,158,11,0.34)]",
              glow: "from-rose-400 via-red-400 to-amber-300",
            }
          : walletRank === "Diamond"
            ? {
                shell:
                  "border-cyan-100/34 bg-[linear-gradient(135deg,#22d3ee,#2563eb,#a78bfa)] text-white shadow-[0_0_34px_rgba(34,211,238,0.34)]",
                icon: "bg-[linear-gradient(135deg,#67e8f9,#818cf8)] text-black shadow-[0_0_34px_rgba(103,232,249,0.34)]",
                glow: "from-cyan-300 via-blue-400 to-violet-300",
              }
            : walletRank === "Emerald"
              ? {
                  shell:
                    "border-emerald-200/30 bg-[linear-gradient(135deg,#10b981,#047857,#22d3ee)] text-white shadow-[0_0_30px_rgba(16,185,129,0.30)]",
                  icon: "bg-[linear-gradient(135deg,#34d399,#06b6d4)] text-black shadow-[0_0_30px_rgba(52,211,153,0.32)]",
                  glow: "from-emerald-300 via-teal-300 to-cyan-300",
                }
              : walletRank === "Platinum"
                ? {
                    shell:
                      "border-slate-100/28 bg-[linear-gradient(135deg,#e2e8f0,#94a3b8,#64748b)] text-black shadow-[0_0_28px_rgba(226,232,240,0.24)]",
                    icon: "bg-[linear-gradient(135deg,#f8fafc,#94a3b8)] text-black shadow-[0_0_28px_rgba(226,232,240,0.28)]",
                    glow: "from-slate-100 via-slate-300 to-slate-500",
                  }
                : walletRank === "Gold"
                  ? {
                      shell:
                        "border-amber-200/30 bg-[linear-gradient(135deg,#facc15,#f59e0b,#92400e)] text-black shadow-[0_0_28px_rgba(250,204,21,0.28)]",
                      icon: "bg-[linear-gradient(135deg,#fde68a,#f59e0b)] text-black shadow-[0_0_26px_rgba(245,158,11,0.30)]",
                      glow: "from-yellow-200 via-amber-300 to-orange-500",
                    }
                  : walletRank === "Silver"
                    ? {
                        shell:
                          "border-zinc-100/24 bg-[linear-gradient(135deg,#f4f4f5,#a1a1aa,#52525b)] text-black shadow-[0_0_24px_rgba(212,212,216,0.22)]",
                        icon: "bg-[linear-gradient(135deg,#fafafa,#a1a1aa)] text-black shadow-[0_0_22px_rgba(212,212,216,0.22)]",
                        glow: "from-zinc-100 via-zinc-300 to-zinc-500",
                      }
                    : walletRank === "Bronze"
                      ? {
                          shell:
                            "border-orange-200/24 bg-[linear-gradient(135deg,#fb923c,#9a3412,#431407)] text-white shadow-[0_0_22px_rgba(251,146,60,0.20)]",
                          icon: "bg-[linear-gradient(135deg,#fdba74,#c2410c)] text-black shadow-[0_0_20px_rgba(251,146,60,0.22)]",
                          glow: "from-orange-300 via-orange-600 to-stone-800",
                        }
                      : walletRank === "Iron"
                        ? {
                            shell:
                              "border-stone-300/20 bg-[linear-gradient(135deg,#78716c,#44403c,#1c1917)] text-white shadow-[0_0_18px_rgba(120,113,108,0.18)]",
                            icon: "bg-[linear-gradient(135deg,#a8a29e,#44403c)] text-white shadow-[0_0_18px_rgba(120,113,108,0.20)]",
                            glow: "from-stone-300 via-stone-500 to-stone-800",
                          }
                        : {
                            shell:
                              "border-white/12 bg-white/[0.055] text-white shadow-[0_0_18px_rgba(255,255,255,0.10)]",
                            icon: "bg-violet-500 text-white shadow-[0_0_24px_rgba(139,92,246,0.26)]",
                            glow: "from-violet-400 via-white/40 to-white/10",
                          };

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
    <>
      <div className="min-h-screen overflow-hidden bg-[#111119] text-white">
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(151,139,255,0.20),transparent_34%),radial-gradient(circle_at_12%_32%,rgba(251,113,133,0.11),transparent_24%),radial-gradient(circle_at_88%_70%,rgba(253,224,71,0.10),transparent_20%),linear-gradient(180deg,#171722_0%,#0d0d12_48%,#08080b_100%)]" />
          <div className="absolute inset-0 opacity-[0.23] [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:34px_34px]" />
          <div className="absolute -left-28 top-24 h-[520px] w-[520px] rounded-full border border-white/8" />
          <div className="absolute -left-20 top-32 h-[430px] w-[430px] rounded-full border border-white/6" />
          <div className="absolute -right-24 bottom-6 h-[520px] w-[520px] rounded-full border border-white/7" />
        </div>

        <main className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:gap-8 xl:px-8">
          <section className="mx-auto w-full max-w-[430px] rounded-[46px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,16,24,0.92),rgba(8,8,12,0.98))] p-5 shadow-[0_40px_130px_rgba(0,0,0,0.62)] backdrop-blur-2xl sm:p-7 lg:rotate-[-1.5deg]">
            <div className="flex items-center justify-between">
              <div className={`grid h-14 w-14 place-items-center rounded-full ${rankStyle.icon}`}>
                <Gem className="h-7 w-7" />
              </div>
              <div className="hidden">
                <span>+</span>
                <span className="text-3xl">⌕</span>
                <span className="text-3xl">≡</span>
              </div>
            </div>

            <div className="mt-10 flex flex-col items-center text-center">
              <div className="relative">
                <Link
                  href="/profile/me"
                  className="relative block h-20 w-20 overflow-hidden rounded-[28px] border border-white/16 bg-white/8 p-1 shadow-[0_18px_50px_rgba(0,0,0,0.42)] transition hover:scale-[1.03]"
                >
                  <Image
                    src={safeImage(safeUser.image)}
                    alt={displayName}
                    fill
                    sizes="80px"
                    className="object-cover p-1"
                    priority
                  />
                </Link>
                <div className="absolute -bottom-1 -right-2 grid h-8 w-8 place-items-center rounded-full bg-[#fff2a8] text-black shadow-[0_0_25px_rgba(253,224,71,0.28)]">
                  <Sparkles className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-5 text-sm text-white/42">Available Balance</div>
              <h1 className="mt-1 text-[42px] font-light tracking-[-0.07em] text-white sm:text-[50px]">
                {formatNumber(nexPoint)} NEX
              </h1>
              <div className="mt-1 text-2xl font-light tracking-[-0.04em] text-white/62">
                {formatNumber(coin)} COIN
              </div>

              <div className={`relative mt-5 flex items-center gap-2 overflow-hidden rounded-2xl border px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.24)] ${rankStyle.shell}`}>
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${rankStyle.glow}`} />
                <span className="font-black text-white">Rank</span>
                <span className="text-white/80">{walletRank}</span>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-[1.4fr_1fr_0.7fr_0.45fr] gap-2">
              <div>
                <div className="h-3 rounded-full bg-[linear-gradient(90deg,#8b5cf6,#fb7185)]" />
                <div className="mt-2 text-xs text-white/72">{formatNumber(nexPoint)} NEX</div>
              </div>
              <div>
                <div className="h-3 rounded-full bg-[linear-gradient(90deg,#f87171,#fecaca)]" />
                <div className="mt-2 text-xs text-white/72">{formatNumber(coin)} COIN</div>
              </div>
              <div>
                <div className="h-3 rounded-full bg-[#fff7b8]" />
                <div className="mt-2 text-xs text-white/72">{formatNumber(activeCoupons)} coupons</div>
              </div>
              <div>
                <div className="h-3 rounded-full bg-white/10" />
                <div className="mt-2 text-xs text-white/28">live</div>
              </div>
            </div>

            <Link
              href="/rewards"
              className="group mt-8 flex items-center justify-between rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] p-5 transition hover:border-amber-200/25"
            >
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-black">
                  <Gift className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-black">Exchange Rewards</div>
                  <div className="mt-1 text-sm text-white/46">Fast reward redeem method</div>
                </div>
              </div>
              <div className="flex -space-x-3">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-violet-200">
                  <Gem className="h-5 w-5" />
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-black">
                  <Ticket className="h-5 w-5" />
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-cyan-200">
                  <Coins className="h-5 w-5" />
                </div>
              </div>
            </Link>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                { href: "/redeem", title: "Redeem", sub: "Open QR coupons", icon: QrCode },
                { href: "/rewards", title: "Rewards", sub: "Claim items", icon: Gift },
                { href: "/profile/me", title: "Profile", sub: "Wallet owner", icon: ShieldCheck },
                { href: "/community", title: "Community", sub: "Friend network", icon: Sparkles },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-[24px] border border-white/9 bg-white/[0.035] p-4 transition hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-black">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xl leading-none text-white/70">⌝</span>
                    </div>
                    <div className="mt-5 font-black">{item.title}</div>
                    <div className="mt-1 text-sm text-white/42">{item.sub}</div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="mx-auto w-full max-w-[560px] rounded-[46px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,15,23,0.93),rgba(8,8,12,0.99))] p-5 shadow-[0_40px_130px_rgba(0,0,0,0.54)] backdrop-blur-2xl sm:p-7 lg:rotate-[1.3deg]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(135deg,#06b6d4,#2563eb)] text-white shadow-[0_0_28px_rgba(34,211,238,0.25)]">
                  <Coins className="h-6 w-6" />
                </div>
                <div className={`rounded-2xl border px-4 py-2 font-black uppercase tracking-[0.12em] ${rankStyle.shell}`}>
                  {walletRank}
                </div>
              </div>
              <div className="hidden">
                <span>+</span>
                <span>⌕</span>
                <span>≡</span>
              </div>
            </div>

            <div className="relative mt-12 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/10 text-white shadow-[0_0_55px_rgba(255,255,255,0.08)]">
                <Gem className="h-8 w-8" />
              </div>
              <div className="mt-8 text-sm text-white/42">Lifetime Earned</div>
              <div className="mt-2 text-[48px] font-light tracking-[-0.07em]">
                {formatNumber(lifetimeNex)} NEX
              </div>
              <div className="mt-1 text-2xl font-light tracking-[-0.04em] text-white/58">
                {formatNumber(lifetimeCoin)} COIN
              </div>
            </div>

            <div className="mt-8 grid grid-cols-[1.4fr_1fr_0.7fr_0.45fr] gap-2">
              <div>
                <div className="h-3 rounded-full bg-[linear-gradient(90deg,#8b5cf6,#fb7185)]" />
                <div className="mt-2 text-xs text-white/72">{formatNumber(lifetimeNex)} NEX</div>
              </div>
              <div>
                <div className="h-3 rounded-full bg-[linear-gradient(90deg,#f87171,#facc15)]" />
                <div className="mt-2 text-xs text-white/72">{formatNumber(lifetimeCoin)} COIN</div>
              </div>
              <div>
                <div className="h-3 rounded-full bg-[#f7ffc7]" />
                <div className="mt-2 text-xs text-white/72">{formatNumber(activeCoupons)} QR</div>
              </div>
              <div>
                <div className="h-3 rounded-full bg-white/10" />
              </div>
            </div>

            <div className="mt-8 rounded-[30px] border border-white/10 bg-white/[0.028] p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black">Wallet Pulse</h2>
                <Coins className="h-5 w-5 text-white" />
              </div>
              <div className="mt-7 flex justify-center">
                <div className="relative h-44 w-44 rounded-full border-[14px] border-white/10 border-l-pink-400 border-t-pink-300 border-r-violet-300">
                  <div className="absolute inset-8 rounded-full border border-white/10" />
                  <div className="absolute bottom-9 left-1/2 h-1 w-16 origin-left rotate-[-24deg] rounded-full bg-white" />
                  <div className="absolute bottom-[31px] left-[76px] h-4 w-4 rounded-full bg-white" />
                  <div className="absolute inset-0 grid place-items-center text-lg font-black">Live</div>
                </div>
              </div>
              <div className="mt-5 flex justify-center gap-5 text-sm text-white/78">
                <span>• Rank {walletRank}</span>
                <span>• Active QR {formatNumber(activeCoupons)}</span>
                <span>• Used {formatNumber(usedCoupons)}</span>
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-xl font-black">Recent Movement</h2>
              <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10">
                {(activities.length ? activities.slice(0, 4) : assetCards).map((item, index) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_auto] gap-3 border-b border-white/8 px-4 py-3 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-bold text-white">
                        {"title" in item ? item.title : item.label}
                      </div>
                      <div className="mt-1 truncate text-sm text-white/42">{item.subtitle}</div>
                    </div>
                    <div className="text-right text-sm font-black text-white/78">
                      {"createdAt" in item ? timeAgo(item.createdAt) : index === 0 ? "Live" : "Ready"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>

      <div className="hidden min-h-screen bg-[#090909] text-white">
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
                  NEXORA WALLET
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl xl:text-5xl">
                    สินทรัพย์ของฉัน
                  </h1>
                  <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/58 sm:inline-flex sm:items-center sm:gap-2">
                    <Sparkles className="h-4 w-4" />
                    Live Ready
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

            <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="relative overflow-hidden rounded-[30px] border border-amber-300/12 bg-[radial-gradient(circle_at_18%_20%,rgba(251,191,36,0.22),transparent_30%),radial-gradient(circle_at_86%_18%,rgba(34,211,238,0.16),transparent_26%),linear-gradient(135deg,rgba(12,12,16,0.98)_0%,rgba(19,16,31,0.94)_58%,rgba(34,22,7,0.9)_100%)] shadow-[0_24px_100px_rgba(0,0,0,0.42)]">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.08)_42%,transparent_58%)]" />
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
    </>
  );
}
