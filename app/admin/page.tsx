import { prisma } from "@/lib/prisma";
import { formatThaiDate, formatThaiDateTime } from "@/lib/thai-time";
import DashboardCharts from "./DashboardCharts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function StatCard({ title, value, accent }: { title: string; value: number; accent?: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/38">{title}</div>
      <div className={`mt-3 text-3xl font-black sm:text-4xl ${accent || "text-white"}`}>
        {value.toLocaleString("th-TH")}
      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  let totalUsers = 0;
  let totalRewards = 0;
  let totalCoupons = 0;
  let usedCoupons = 0;
  let balanceTotals: { _sum: { nexPoint: number | null; coin: number | null } } | null = null;
  let userCreatedRows: Array<{ createdAt: Date }> = [];
  let latestLogs: Array<{ id: string; lineId: string; type: string; amount: number; point: number; createdAt: Date }> = [];

  try {
    [totalUsers, totalRewards, totalCoupons, usedCoupons, balanceTotals, userCreatedRows, latestLogs] = await Promise.all([
      prisma.user.count(),
      prisma.reward.count(),
      prisma.coupon.count(),
      prisma.coupon.count({ where: { used: true } }),
      prisma.user.aggregate({
        _sum: {
          nexPoint: true,
          coin: true,
        },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.pointLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    ]);
  } catch {}

  const totalNex = Number(balanceTotals?._sum.nexPoint || 0);
  const totalCoin = Number(balanceTotals?._sum.coin || 0);

  const groupedMap = new Map<string, number>();
  for (const user of userCreatedRows) {
    const date = formatThaiDate(user.createdAt);
    groupedMap.set(date, (groupedMap.get(date) || 0) + 1);
  }

  const chartData = Array.from(groupedMap.entries()).map(([date, count]) => ({ date, count }));

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">Admin Dashboard</div>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">ภาพรวมระบบ</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        <StatCard title="Users" value={totalUsers} accent="text-cyan-200" />
        <StatCard title="Rewards" value={totalRewards} accent="text-violet-200" />
        <StatCard title="Coupons" value={totalCoupons} accent="text-white" />
        <StatCard title="Used Coupons" value={usedCoupons} accent="text-emerald-300" />
        <StatCard title="Total NEX" value={Math.round(totalNex)} accent="text-amber-300" />
        <StatCard title="Total Coin" value={totalCoin} accent="text-sky-300" />
      </div>

      <DashboardCharts chartData={chartData} totalUsers={totalUsers} />

      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <h2 className="text-lg font-black sm:text-xl">Point Log ล่าสุด</h2>
        <div className="mt-4 grid gap-3">
          {latestLogs.length === 0 ? (
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5 text-sm text-white/45">
              ยังไม่มีประวัติการเพิ่มแต้ม
            </div>
          ) : (
            latestLogs.map((log) => (
              <div
                key={log.id}
                className="grid gap-3 rounded-[22px] border border-white/8 bg-black/20 p-4 sm:grid-cols-[1.2fr_auto_auto]"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">Line ID</div>
                  <div className="mt-1 break-all text-sm font-bold text-white/88">{log.lineId}</div>
                </div>
                <div className="flex items-center">
                  <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-black uppercase text-amber-300">
                    {log.type}
                  </span>
                </div>
                <div className="text-sm font-bold text-white/72 sm:text-right">
                  +{log.point} • {formatThaiDateTime(log.createdAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
