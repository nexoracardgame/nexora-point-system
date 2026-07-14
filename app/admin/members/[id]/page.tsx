import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCouponValue } from "@/lib/coupon-utils";
import { prisma } from "@/lib/prisma";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";
import { formatThaiDateTime } from "@/lib/thai-time";
import { expireStaleCardRareRedemptions } from "@/lib/card-rare-redemptions";
import {
  expireStaleCardSetRedemptions,
  syncPendingCardSetRedemptionPricing,
} from "@/lib/card-set-redemptions";
import AdminUserAvatar from "@/app/admin/AdminUserAvatar";
import PointLogEvidenceImages from "@/app/admin/point-logs/PointLogEvidenceImages";
import MemberActions from "./MemberActions";

function Card({ title, value, gold }: { title: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">{title}</div>
      <div className={`mt-3 break-all text-xl font-black ${gold ? "text-amber-300" : "text-white"}`}>{value}</div>
    </div>
  );
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("th-TH");
}

function formatSignedNumber(value: number) {
  return `${value >= 0 ? "+" : ""}${formatNumber(value)}`;
}

function getLogDisplay(log: { type: string; amount: number; point: number }) {
  const type = String(log.type || "").trim().toLowerCase();
  const isCoin = type.includes("coin");
  const currency = isCoin ? "COIN" : "NEX";
  const value = isCoin ? Number(log.amount || 0) : Number(log.point || 0);

  if (type === "coupon_rollback_coin") {
    return {
      typeLabel: "rollback coin",
      amountLabel: `ย้อนกลับคูปอง คืน ${formatNumber(Math.abs(value))} COIN`,
      valueLabel: `${formatSignedNumber(value)} COIN`,
      badgeClass: "border-sky-300/20 bg-sky-300/10 text-sky-200",
      valueClass: "text-sky-300",
    };
  }

  if (type === "coupon_rollback_nex") {
    return {
      typeLabel: "rollback nex",
      amountLabel: `ย้อนกลับคูปอง คืน ${formatNumber(Math.abs(value))} NEX`,
      valueLabel: `${formatSignedNumber(value)} NEX`,
      badgeClass: "border-amber-300/18 bg-amber-300/10 text-amber-300",
      valueClass: "text-amber-300",
    };
  }

  if (type === "admin_coin") {
    return {
      typeLabel: "admin coin",
      amountLabel: `${value >= 0 ? "เพิ่ม" : "ลด"} ${formatNumber(Math.abs(value))} COIN`,
      valueLabel: `${formatSignedNumber(value)} COIN`,
      badgeClass: "border-sky-300/20 bg-sky-300/10 text-sky-200",
      valueClass: "text-sky-300",
    };
  }

  if (type === "admin") {
    return {
      typeLabel: "admin nex",
      amountLabel: `${value >= 0 ? "เพิ่ม" : "ลด"} ${formatNumber(Math.abs(value))} NEX`,
      valueLabel: `${formatSignedNumber(value)} NEX`,
      badgeClass: "border-amber-300/18 bg-amber-300/10 text-amber-300",
      valueClass: "text-amber-300",
    };
  }

  return {
    typeLabel: log.type,
    amountLabel: isCoin
      ? `${formatNumber(Math.abs(value))} COIN`
      : `จำนวน ${formatNumber(log.amount)}`,
    valueLabel: `${formatSignedNumber(value)} ${currency}`,
    badgeClass: isCoin
      ? "border-sky-300/20 bg-sky-300/10 text-sky-200"
      : "border-amber-300/18 bg-amber-300/10 text-amber-300",
    valueClass: isCoin ? "text-sky-300" : "text-amber-300",
  };
}

type MemberPointLog = {
  id: string;
  lineId: string;
  type: string;
  amount: number;
  point: number;
  note: string | null;
  evidenceJson: string | null;
  createdAt: Date;
};

type MemberCardSetLog = {
  id: string;
  code: string;
  setOrder: number;
  setName: string;
  rewardLabel: string;
  redemptionType: string | null;
  conditionLabel: string | null;
  nexValue: number;
  status: string;
  createdAt: Date;
  approvedAt: Date | null;
};

type MemberCardSetStats = {
  approvedCount: bigint | number;
  totalNexValue: number | null;
};

type MemberCardRareStats = {
  approvedCount: bigint | number;
  totalNexValue: number | null;
};

type MemberCardRareLog = {
  id: string;
  code: string;
  cardNo: string;
  cardName: string;
  rewardLabel: string;
  optionKey: string | null;
  conditionLabel: string | null;
  nexValue: number;
  status: string;
  createdAt: Date;
  approvedAt: Date | null;
};

type MemberCouponHistory = {
  id: string;
  code: string;
  used: boolean;
  createdAt: Date;
  usedAt: Date | null;
  reversedAt: Date | null;
  reversalReason: string | null;
  reward: {
    id: string;
    name: string;
    nexCost: number | null;
    coinCost: number | null;
  };
};

function getCouponStatus(coupon: MemberCouponHistory) {
  if (coupon.reversedAt) {
    return {
      label: "ย้อนกลับแล้ว",
      className: "border-red-300/20 bg-red-300/10 text-red-200",
    };
  }

  if (coupon.used) {
    return {
      label: "ใช้งานแล้ว",
      className: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
    };
  }

  return {
    label: "พร้อมใช้",
    className: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
  };
}

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  await prisma.$executeRawUnsafe('ALTER TABLE "PointLog" ADD COLUMN IF NOT EXISTS "note" TEXT').catch(() => undefined);
  await prisma.$executeRawUnsafe('ALTER TABLE "PointLog" ADD COLUMN IF NOT EXISTS "evidenceJson" TEXT').catch(() => undefined);
  await Promise.all([
    expireStaleCardSetRedemptions(user.id).catch(() => undefined),
    expireStaleCardRareRedemptions(user.id).catch(() => undefined),
  ]);
  await syncPendingCardSetRedemptionPricing(user.id, "all").catch(
    () => undefined
  );

  const [
    localProfile,
    logs,
    cardSetStatsRows,
    cardSetLogs,
    cardRareStatsRows,
    cardRareLogs,
    coupons,
  ] = await Promise.all([
    getLocalProfileByUserId(user.id).catch(() => null),
    prisma.$queryRawUnsafe<MemberPointLog[]>(
      `
        SELECT
          "id",
          "lineId",
          "type",
          "amount",
          "point",
          "note",
          "evidenceJson",
          "createdAt"
        FROM "PointLog"
        WHERE "lineId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 20
      `,
      user.lineId
    ),
    prisma.$queryRawUnsafe<MemberCardSetStats[]>(
      `
        SELECT
          COUNT(*) AS "approvedCount",
          COALESCE(SUM("nexValue"), 0) AS "totalNexValue"
        FROM "CardSetRedemptionLog"
        WHERE "userId" = $1
          AND "status" = 'approved'
      `,
      user.id
    ).catch(() => []),
    prisma.$queryRawUnsafe<MemberCardSetLog[]>(
      `
        SELECT
          "id",
          "code",
          "setOrder",
          "setName",
          "rewardLabel",
          "redemptionType",
          "conditionLabel",
          "nexValue",
          "status",
          "createdAt",
          "approvedAt"
        FROM "CardSetRedemptionLog"
        WHERE "userId" = $1
          AND "status" = 'approved'
        ORDER BY COALESCE("approvedAt", "createdAt") DESC
        LIMIT 100
      `,
      user.id
    ).catch(() => []),
    prisma.$queryRawUnsafe<MemberCardRareStats[]>(
      `
        SELECT
          COUNT(*) AS "approvedCount",
          COALESCE(SUM("nexValue"), 0) AS "totalNexValue"
        FROM "CardRareRedemptionLog"
        WHERE "userId" = $1
          AND "status" = 'approved'
      `,
      user.id
    ).catch(() => []),
    prisma.$queryRawUnsafe<MemberCardRareLog[]>(
      `
        SELECT
          "id",
          "code",
          "cardNo",
          "cardName",
          "rewardLabel",
          "optionKey",
          "conditionLabel",
          "nexValue",
          "status",
          "createdAt",
          "approvedAt"
        FROM "CardRareRedemptionLog"
        WHERE "userId" = $1
          AND "status" = 'approved'
        ORDER BY COALESCE("approvedAt", "createdAt") DESC
        LIMIT 100
      `,
      user.id
    ).catch(() => []),
    prisma.coupon.findMany({
      where: { userId: user.id },
      include: {
        reward: {
          select: {
            id: true,
            name: true,
            nexCost: true,
            coinCost: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
  ]);

  const displayName = localProfile?.displayName || user.displayName || user.name || "-";
  const profileImage = localProfile?.image || user.image;

  const cardSetStats = cardSetStatsRows[0] || {
    approvedCount: 0,
    totalNexValue: 0,
  };
  const cardRareStats = cardRareStatsRows[0] || {
    approvedCount: 0,
    totalNexValue: 0,
  };
  const unusedCoupons = coupons.filter(
    (coupon) => !coupon.used && !coupon.reversedAt
  ).length;
  const usedCoupons = coupons.filter(
    (coupon) => coupon.used && !coupon.reversedAt
  ).length;
  const reversedCoupons = coupons.filter((coupon) => coupon.reversedAt).length;
  const couponNexValue = coupons.reduce((sum, coupon) => {
    const value = formatCouponValue(coupon.code, coupon.reward);
    return value.currency === "NEX" ? sum + Number(value.amount || 0) : sum;
  }, 0);
  const couponCoinValue = coupons.reduce((sum, coupon) => {
    const value = formatCouponValue(coupon.code, coupon.reward);
    return value.currency === "COIN" ? sum + Number(value.amount || 0) : sum;
  }, 0);

  return (
    <div className="space-y-5 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">Member Detail</div>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">รายละเอียดสมาชิก</h1>
        </div>
        <Link href="/admin/members" className="inline-flex rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-white">
          กลับหน้าสมาชิก
        </Link>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <AdminUserAvatar src={profileImage} name={displayName} size="lg" />
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/35">
              Verified Profile
            </div>
            <h2 className="mt-2 break-words text-2xl font-black text-white sm:text-3xl">
              {displayName}
            </h2>
            <div className="mt-2 break-all text-sm font-bold text-white/50">
              {user.lineId}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <Card title="ชื่อ" value={displayName} />
        <Card title="Line ID" value={user.lineId} />
        <Card title="NEX" value={String(user.nexPoint)} gold />
        <Card title="Coin" value={String(user.coin)} />
        <Card
          title="CARD SET แลกสำเร็จ"
          value={`${formatNumber(Number(cardSetStats.approvedCount || 0))} เซ็ต`}
          gold
        />
        <Card
          title="CARD SET มูลค่ารวม"
          value={`${formatNumber(Number(cardSetStats.totalNexValue || 0))} NEX`}
          gold
        />
        <Card
          title="CARD RARE แลกสำเร็จ"
          value={`${formatNumber(Number(cardRareStats.approvedCount || 0))} ใบ`}
          gold
        />
        <Card
          title="CARD RARE มูลค่ารวม"
          value={`${formatNumber(Number(cardRareStats.totalNexValue || 0))} NEX`}
          gold
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-6">
        <Card title="คูปองทั้งหมด" value={`${formatNumber(coupons.length)} ใบ`} />
        <Card title="คูปองพร้อมใช้" value={`${formatNumber(unusedCoupons)} ใบ`} />
        <Card title="คูปองใช้แล้ว" value={`${formatNumber(usedCoupons)} ใบ`} />
        <Card title="คูปองย้อนกลับ" value={`${formatNumber(reversedCoupons)} ใบ`} />
        <Card
          title="มูลค่าคูปอง NEX"
          value={`${formatNumber(couponNexValue)} NEX`}
          gold
        />
        <Card
          title="มูลค่าคูปอง COIN"
          value={`${formatNumber(couponCoinValue)} COIN`}
        />
      </div>

      <div className="flex justify-end">
        <Link
          href={`/admin/card-rare-logs?q=${encodeURIComponent(user.lineId)}`}
          className="rounded-2xl border border-violet-300/20 bg-violet-300/10 px-4 py-3 text-sm font-black text-violet-100"
        >
          ดูประวัติ CARD RARE ใน Logs
        </Link>
      </div>

      <MemberActions lineId={user.lineId} />

      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black sm:text-xl">ประวัติคูปองและการแลกรางวัล</h2>
          <Link
            href={`/admin/coupons?q=${encodeURIComponent(user.lineId)}`}
            className="text-sm font-black text-cyan-200 hover:text-cyan-100"
          >
            ดูใน Coupons
          </Link>
        </div>
        <div className="mt-4 grid gap-3">
          {coupons.length === 0 ? (
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5 text-sm text-white/45">
              ยังไม่มีประวัติคูปองหรือการแลกรางวัล
            </div>
          ) : (
            coupons.map((coupon) => {
              const status = getCouponStatus(coupon);
              const value = formatCouponValue(coupon.code, coupon.reward);

              return (
                <div
                  key={coupon.id}
                  className="rounded-[22px] border border-white/8 bg-black/20 p-4"
                >
                  <div className="grid gap-3 xl:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_auto] xl:items-start">
                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase ${status.className}`}
                    >
                      {status.label}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-black text-white">
                        {coupon.reward.name}
                      </div>
                      <div className="mt-1 break-all text-xs font-bold text-white/42">
                        {coupon.code}
                      </div>
                      {coupon.reversalReason ? (
                        <div className="mt-2 rounded-full bg-red-300/10 px-3 py-1 text-[11px] font-black text-red-200">
                          {coupon.reversalReason}
                        </div>
                      ) : null}
                    </div>
                    <div className="grid gap-2 text-xs font-bold text-white/55 sm:grid-cols-3 xl:grid-cols-1">
                      <div>
                        <span className="text-white/30">สร้าง: </span>
                        {formatThaiDateTime(coupon.createdAt)}
                      </div>
                      <div>
                        <span className="text-white/30">ใช้: </span>
                        {coupon.usedAt ? formatThaiDateTime(coupon.usedAt) : "-"}
                      </div>
                      <div>
                        <span className="text-white/30">ย้อนกลับ: </span>
                        {coupon.reversedAt ? formatThaiDateTime(coupon.reversedAt) : "-"}
                      </div>
                    </div>
                    <div className="text-left xl:text-right">
                      <div
                        className={`text-sm font-black ${
                          value.currency === "COIN" ? "text-cyan-200" : "text-amber-300"
                        }`}
                      >
                        {value.label}
                      </div>
                      <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/32">
                        ใช้ {value.currency || "VALUE"} แลก
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black sm:text-xl">ประวัติการแลก CARD SET</h2>
          <Link
            href={`/admin/card-set-logs?q=${encodeURIComponent(user.lineId)}`}
            className="text-sm font-black text-amber-300 hover:text-amber-200"
          >
            ดูใน Card Set Logs
          </Link>
        </div>
        <div className="mt-4 grid gap-3">
          {cardSetLogs.length === 0 ? (
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5 text-sm text-white/45">
              ยังไม่มีประวัติการแลก CARD SET
            </div>
          ) : (
            cardSetLogs.map((log) => (
              <div
                key={log.id}
                className="grid gap-3 rounded-[22px] border border-white/8 bg-black/20 p-4 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto] lg:items-center"
              >
                <span
                  className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase ${
                    log.status === "approved"
                      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                      : log.status === "pending"
                        ? "border-amber-300/20 bg-amber-300/10 text-amber-200"
                        : "border-red-300/20 bg-red-300/10 text-red-200"
                  }`}
                >
                  {log.status}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-black text-white">
                    Set {log.setOrder} {log.setName}
                  </div>
                  <div className="mt-1 line-clamp-1 text-xs font-bold text-white/42">
                    {log.code}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="w-fit rounded-full bg-amber-300/10 px-3 py-1 text-[11px] font-black text-amber-200">
                      {log.conditionLabel
                        ? "แบบเงื่อนไขเสริม"
                        : "แบบธรรมดา"}
                    </span>
                    {log.conditionLabel ? (
                      <span className="w-fit rounded-full bg-white/[0.05] px-3 py-1 text-[11px] font-black text-white/52">
                        {log.conditionLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="text-sm font-black text-amber-300">
                  {formatNumber(Number(log.nexValue || 0))} NEX
                </div>
                <div className="text-xs text-white/42 lg:text-right">
                  {formatThaiDateTime(log.approvedAt || log.createdAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black sm:text-xl">ประวัติการแลก CARD RARE</h2>
          <Link
            href={`/admin/card-rare-logs?q=${encodeURIComponent(user.lineId)}`}
            className="text-sm font-black text-violet-200 hover:text-violet-100"
          >
            ดูใน Card Rare Logs
          </Link>
        </div>
        <div className="mt-4 grid gap-3">
          {cardRareLogs.length === 0 ? (
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5 text-sm text-white/45">
              ยังไม่มีประวัติการแลก CARD RARE
            </div>
          ) : (
            cardRareLogs.map((log) => (
              <div
                key={log.id}
                className="grid gap-3 rounded-[22px] border border-white/8 bg-black/20 p-4 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto] lg:items-center"
              >
                <span
                  className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase ${
                    log.status === "approved"
                      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                      : log.status === "pending"
                        ? "border-violet-300/20 bg-violet-300/10 text-violet-100"
                        : "border-red-300/20 bg-red-300/10 text-red-200"
                  }`}
                >
                  {log.status}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-black text-white">
                    No. {log.cardNo} {log.cardName}
                  </div>
                  <div className="mt-1 line-clamp-1 text-xs font-bold text-white/42">
                    {log.code}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="w-fit rounded-full bg-violet-300/10 px-3 py-1 text-[11px] font-black text-violet-100">
                      {log.conditionLabel ? "แบบเงื่อนไขพิเศษ" : "แบบมาตรฐาน"}
                    </span>
                    {log.conditionLabel ? (
                      <span className="w-fit rounded-full bg-white/[0.05] px-3 py-1 text-[11px] font-black text-white/52">
                        {log.conditionLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="text-sm font-black text-violet-200">
                  {formatNumber(Number(log.nexValue || 0))} NEX
                </div>
                <div className="text-xs text-white/42 lg:text-right">
                  {formatThaiDateTime(log.approvedAt || log.createdAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <h2 className="text-lg font-black sm:text-xl">ประวัติการเพิ่ม-ลดแต้ม</h2>
        <div className="mt-4 grid gap-3">
          {logs.length === 0 ? (
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5 text-sm text-white/45">
              ยังไม่มีประวัติการเพิ่ม-ลดแต้ม
            </div>
          ) : (
            logs.map((log) => {
              const display = getLogDisplay(log);

              return (
                <div key={log.id} className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                  <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center">
                    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase ${display.badgeClass}`}>{display.typeLabel}</span>
                    <div className="text-sm font-bold text-white/75">{display.amountLabel}</div>
                    <div className={`text-sm font-black ${display.valueClass}`}>{display.valueLabel}</div>
                    <div className="text-xs text-white/42 sm:text-right">{formatThaiDateTime(log.createdAt)}</div>
                  </div>
                  {log.note ? (
                    <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                        หมายเหตุ
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-sm font-bold leading-6 text-white/78">
                        {log.note}
                      </div>
                    </div>
                  ) : null}
                  <PointLogEvidenceImages evidenceJson={log.evidenceJson} />
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
