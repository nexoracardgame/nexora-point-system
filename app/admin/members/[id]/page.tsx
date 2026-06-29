import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureCardSetRedemptionSchema } from "@/lib/card-set-redemptions";
import { prisma } from "@/lib/prisma";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";
import { formatThaiDateTime } from "@/lib/thai-time";
import AdminUserAvatar from "@/app/admin/AdminUserAvatar";
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

function getLogDisplay(log: { type: string; amount: number; point: number }) {
  const type = String(log.type || "").trim().toLowerCase();

  if (type === "coupon_rollback_coin") {
    return {
      typeLabel: "rollback coin",
      amountLabel: `ย้อนกลับคูปอง คืน ${formatNumber(log.amount)} COIN`,
      valueLabel: `+${formatNumber(log.amount)} COIN`,
      badgeClass: "border-sky-300/20 bg-sky-300/10 text-sky-200",
      valueClass: "text-sky-300",
    };
  }

  if (type === "coupon_rollback_nex") {
    return {
      typeLabel: "rollback nex",
      amountLabel: "ย้อนกลับคูปอง",
      valueLabel: `+${formatNumber(log.point)} NEX`,
      badgeClass: "border-amber-300/18 bg-amber-300/10 text-amber-300",
      valueClass: "text-amber-300",
    };
  }

  return {
    typeLabel: log.type,
    amountLabel: `จำนวน ${formatNumber(log.amount)}`,
    valueLabel: `+${formatNumber(log.point)}`,
    badgeClass: "border-amber-300/18 bg-amber-300/10 text-amber-300",
    valueClass: "text-amber-300",
  };
}

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

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();
  const localProfile = await getLocalProfileByUserId(user.id).catch(() => null);
  const displayName = localProfile?.displayName || user.displayName || user.name || "-";
  const profileImage = localProfile?.image || user.image;

  const logs = await prisma.pointLog.findMany({
    where: { lineId: user.lineId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  await ensureCardSetRedemptionSchema();

  const [cardSetStatsRows, cardSetLogs] = await Promise.all([
    prisma.$queryRawUnsafe<MemberCardSetStats[]>(
      `
        SELECT
          COUNT(*) FILTER (WHERE "status" = 'approved') AS "approvedCount",
          COALESCE(SUM("nexValue") FILTER (WHERE "status" = 'approved'), 0) AS "totalNexValue"
        FROM "CardSetRedemption"
        WHERE "userId" = $1
      `,
      user.id
    ),
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
        FROM "CardSetRedemption"
        WHERE "userId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 20
      `,
      user.id
    ),
  ]);

  const cardSetStats = cardSetStatsRows[0] || {
    approvedCount: 0,
    totalNexValue: 0,
  };

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
      </div>

      <MemberActions lineId={user.lineId} />

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
                      {log.redemptionType === "foil_bonus"
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
        <h2 className="text-lg font-black sm:text-xl">ประวัติการเพิ่มแต้ม</h2>
        <div className="mt-4 grid gap-3">
          {logs.length === 0 ? (
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5 text-sm text-white/45">
              ยังไม่มีประวัติการเพิ่มแต้ม
            </div>
          ) : (
            logs.map((log) => {
              const display = getLogDisplay(log);

              return (
                <div key={log.id} className="grid gap-3 rounded-[22px] border border-white/8 bg-black/20 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center">
                  <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase ${display.badgeClass}`}>{display.typeLabel}</span>
                  <div className="text-sm font-bold text-white/75">{display.amountLabel}</div>
                  <div className={`text-sm font-black ${display.valueClass}`}>{display.valueLabel}</div>
                  <div className="text-xs text-white/42 sm:text-right">{formatThaiDateTime(log.createdAt)}</div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
