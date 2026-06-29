import { prisma } from "@/lib/prisma";
import { ensureCouponRollbackSchema } from "@/lib/coupon-rollback-schema";
import { serializeCouponRecord } from "@/lib/coupon-utils";
import AutoSubmitSelect from "@/app/admin/AutoSubmitSelect";
import CouponsTable from "./CouponsTable";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

export default async function AdminCouponsPage({ searchParams }: PageProps) {
  const { q = "", status = "all" } = await searchParams;
  const safeStatus = ["all", "used", "unused", "reversed"].includes(status)
    ? status
    : "all";
  const statusWhere =
    safeStatus === "used"
      ? { used: true, reversedAt: null }
      : safeStatus === "unused"
        ? { used: false, reversedAt: null }
        : safeStatus === "reversed"
          ? { reversedAt: { not: null } }
          : {};

  await ensureCouponRollbackSchema();

  const coupons = await prisma.coupon.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { code: { contains: q } },
              { user: { name: { contains: q } } },
              { user: { displayName: { contains: q } } },
              { user: { lineId: { contains: q } } },
              { reward: { name: { contains: q } } },
            ],
          }
        : {}),
      ...statusWhere,
    },
    include: {
      user: {
        select: {
          id: true,
          lineId: true,
          name: true,
          displayName: true,
          image: true,
        },
      },
      reward: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          nexCost: true,
          coinCost: true,
        },
      },
    },
    orderBy: [{ used: "asc" }, { createdAt: "desc" }],
    take: 500,
  });

  return (
    <div className="space-y-5 text-white">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">
          Admin Coupons
        </div>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">คูปองทั้งหมด</h1>
      </div>

      <form method="GET" className="grid gap-3 sm:grid-cols-[1fr_220px_auto]">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="ค้นหา code / ชื่อ / line id / reward"
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 font-bold text-white outline-none placeholder:text-white/35 focus:border-amber-300/35 focus:ring-2 focus:ring-amber-300/10"
        />

        <AutoSubmitSelect name="status" defaultValue={safeStatus}>
          <option value="all">ทั้งหมด</option>
          <option value="used">ใช้งานแล้ว</option>
          <option value="unused">พร้อมใช้</option>
          <option value="reversed">ย้อนกลับแล้ว</option>
        </AutoSubmitSelect>

        <button
          type="submit"
          className="rounded-2xl bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-5 py-3 text-sm font-black text-black"
        >
          ค้นหา
        </button>
      </form>

      <CouponsTable coupons={coupons.map((coupon) => serializeCouponRecord(coupon))} />
    </div>
  );
}
