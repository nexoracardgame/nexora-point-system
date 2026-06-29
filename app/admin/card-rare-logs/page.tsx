import Link from "next/link";
import { ensureCardRareRedemptionSchema } from "@/lib/card-rare-redemptions";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "@/lib/thai-time";

type PageProps = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

type CardRareLogRow = {
  id: string;
  code: string;
  userId: string;
  cardNo: string;
  cardName: string;
  rewardLabel: string;
  optionKey: string | null;
  conditionLabel: string | null;
  nexValue: number;
  status: string;
  createdAt: Date;
  approvedAt: Date | null;
  expiresAt: Date;
  name: string | null;
  displayName: string | null;
  lineId: string | null;
};

function normalize(value: string) {
  return value.toLowerCase().trim().replace(/^@+/, "");
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("th-TH");
}

function getStatusClass(status: string) {
  if (status === "approved") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-200";
  if (status === "pending") return "border-violet-300/20 bg-violet-300/10 text-violet-100";
  return "border-red-300/20 bg-red-300/10 text-red-200";
}

export default async function CardRareLogsPage({ searchParams }: PageProps) {
  const { q = "", status = "all" } = await searchParams;
  const keyword = normalize(q);
  const safeStatus = String(status || "all").trim().toLowerCase();

  await ensureCardRareRedemptionSchema();

  const rows = await prisma.$queryRawUnsafe<CardRareLogRow[]>(
    `
      SELECT
        r."id",
        r."code",
        r."userId",
        r."cardNo",
        r."cardName",
        r."rewardLabel",
        r."optionKey",
        r."conditionLabel",
        r."nexValue",
        r."status",
        r."createdAt",
        r."approvedAt",
        r."expiresAt",
        u."name",
        u."displayName",
        u."lineId"
      FROM "CardRareRedemption" r
      LEFT JOIN "User" u ON u."id" = r."userId"
      WHERE ($1::text = 'all' OR r."status" = $1::text)
      ORDER BY r."createdAt" DESC
      LIMIT $2
    `,
    safeStatus,
    keyword ? 1000 : 250
  );

  const filteredRows = keyword
    ? rows.filter((row) =>
        [
          row.code,
          row.cardNo,
          row.cardName,
          row.name,
          row.displayName,
          row.lineId,
          row.userId,
        ]
          .map((value) => normalize(String(value || "")))
          .some((field) => field.includes(keyword))
      )
    : rows;

  return (
    <div className="space-y-5 text-white">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">
          Admin Logs
        </div>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Card Rare Logs</h1>
      </div>

      <form method="GET" className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="ค้นหาชื่อ, Line ID, serial, card no"
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none placeholder:text-white/35"
        />
        <select
          name="status"
          defaultValue={safeStatus}
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
        >
          <option value="all">ทั้งหมด</option>
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="cancelled">cancelled</option>
          <option value="expired">expired</option>
        </select>
        <button
          type="submit"
          className="rounded-2xl bg-[linear-gradient(135deg,#f5d0fe,#a855f7,#6d28d9)] px-5 py-3 text-sm font-black text-white"
        >
          ค้นหา
        </button>
      </form>

      <div className="grid gap-3">
        {filteredRows.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 text-sm text-white/45">
            ไม่พบประวัติการแลก CARD RARE
          </div>
        ) : (
          filteredRows.slice(0, 250).map((row) => {
            const displayName = row.displayName || row.name || "Unknown member";

            return (
              <div
                key={row.id}
                className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                      Member
                    </div>
                    <Link
                      href={`/admin/members/${row.userId}`}
                      className="mt-1 block truncate text-base font-black text-white hover:text-violet-200"
                    >
                      {displayName}
                    </Link>
                    <div className="mt-2 break-all rounded-full bg-white/[0.05] px-3 py-1 text-xs font-bold text-white/52 ring-1 ring-white/10">
                      {row.lineId || row.userId}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                      Card Rare
                    </div>
                    <div className="mt-1 text-base font-black text-white">
                      No. {row.cardNo} {row.cardName}
                    </div>
                    <div className="mt-1 line-clamp-1 text-xs font-bold text-white/46">
                      {row.rewardLabel}
                    </div>
                    {row.conditionLabel ? (
                      <div className="mt-2 w-fit rounded-full bg-violet-300/10 px-3 py-1 text-[11px] font-black text-violet-100">
                        {row.conditionLabel}
                      </div>
                    ) : null}
                  </div>

                  <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase ${getStatusClass(row.status)}`}>
                    {row.status}
                  </span>

                  <div className="text-right">
                    <div className="text-sm font-black text-violet-200">
                      {formatNumber(row.nexValue)} NEX
                    </div>
                    <div className="mt-1 text-xs text-white/42">
                      {formatThaiDateTime(row.approvedAt || row.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 break-all text-xs font-bold text-white/42">
                  {row.code}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
