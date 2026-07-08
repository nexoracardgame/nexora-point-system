import { prisma } from "@/lib/prisma";
import { getAllLocalProfiles } from "@/lib/local-profile-store";
import { ensureCriticalBackupSchema } from "@/lib/critical-backup";
import AutoSubmitSelect from "@/app/admin/AutoSubmitSelect";
import PointLogsTable from "./PointLogsTable";

type PageProps = {
  searchParams: Promise<{ q?: string; type?: string }>;
};

type PointLogWithUserRow = {
  id: string;
  lineId: string;
  type: string;
  amount: number | null;
  point: number | null;
  note: string | null;
  evidenceJson: string | null;
  createdAt: Date;
  userId: string | null;
  name: string | null;
  displayName: string | null;
  username: string | null;
};

type BackupCoinLogRow = PointLogWithUserRow;

const LOG_FILTERS = new Set(["all", "nex", "coin"]);

function normalizeSearch(value: string) {
  return value.toLowerCase().trim().replace(/^@+/, "");
}

function getLogCurrency(log: { type: string }) {
  const type = String(log.type || "").trim().toLowerCase();
  return type.includes("coin") ? "COIN" : "NEX";
}

function getLogValue(log: { type: string; point: number; amount: number }) {
  return getLogCurrency(log) === "COIN"
    ? Number(log.amount || 0)
    : Number(log.point || 0);
}

export default async function PointLogsPage({ searchParams }: PageProps) {
  const { q = "", type = "all" } = await searchParams;
  const keyword = normalizeSearch(q);
  const requestedType = String(type || "all").trim().toLowerCase() || "all";
  const safeType = LOG_FILTERS.has(requestedType) ? requestedType : "all";

  await prisma
    .$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT')
    .catch(() => undefined);
  await prisma
    .$executeRawUnsafe('ALTER TABLE "PointLog" ADD COLUMN IF NOT EXISTS "note" TEXT')
    .catch(() => undefined);
  await prisma
    .$executeRawUnsafe('ALTER TABLE "PointLog" ADD COLUMN IF NOT EXISTS "evidenceJson" TEXT')
    .catch(() => undefined);
  await ensureCriticalBackupSchema().catch(() => undefined);

  const [pointLogs, backupCoinLogs, localProfiles] = await Promise.all([
    prisma.$queryRawUnsafe<PointLogWithUserRow[]>(
      `
        SELECT
          p."id",
          p."lineId",
          p."type",
          p."amount",
          p."point",
          p."note",
          p."evidenceJson",
          p."createdAt",
          u."id" AS "userId",
          u."name",
          u."displayName",
          u."username"
        FROM "PointLog" p
        LEFT JOIN "User" u ON u."lineId" = p."lineId"
        WHERE (
          $1::text = 'all'
          OR ($1::text = 'coin' AND LOWER(p."type") LIKE '%coin%')
          OR ($1::text = 'nex' AND LOWER(p."type") NOT LIKE '%coin%')
        )
        ORDER BY p."createdAt" DESC
        LIMIT $2
      `,
      safeType,
      keyword ? 1000 : 200
    ),
    safeType === "nex"
      ? Promise.resolve([] as BackupCoinLogRow[])
      : prisma
          .$queryRawUnsafe<BackupCoinLogRow[]>(
            `
              WITH "coinBackups" AS (
                SELECT
                  ('critical:' || c."id") AS "id",
                  COALESCE(u."lineId", c."afterSnapshot" #>> '{user,lineId}', c."beforeSnapshot" #>> '{user,lineId}', '') AS "lineId",
                  'admin_coin' AS "type",
                  CASE
                    WHEN COALESCE(c."meta"->>'coinAmount', '') ~ '^-?[0-9]+$'
                      THEN (c."meta"->>'coinAmount')::int
                    WHEN COALESCE(c."meta"->>'amount', '') ~ '^-?[0-9]+$'
                      THEN (c."meta"->>'amount')::int
                    ELSE 0
                  END AS "amount",
                  0::double precision AS "point",
                  c."meta"->>'note' AS "note",
                  CASE
                    WHEN c."meta" ? 'evidenceImages' THEN (c."meta"->'evidenceImages')::text
                    ELSE NULL
                  END AS "evidenceJson",
                  c."createdAt",
                  u."id" AS "userId",
                  u."name",
                  u."displayName",
                  u."username"
                FROM "CriticalBackupLog" c
                LEFT JOIN "User" u ON u."id" = c."targetUserId"
                WHERE c."scope" = 'wallet'
                  AND c."action" IN ('admin.coin.adjust', 'admin.wallet.adjust')
                  AND (
                    c."meta"->>'asset' = 'COIN'
                    OR NULLIF(c."meta"->>'coinAmount', '') IS NOT NULL
                  )
              )
              SELECT *
              FROM "coinBackups" b
              WHERE b."lineId" <> ''
                AND b."amount" <> 0
                AND NOT EXISTS (
                  SELECT 1
                  FROM "PointLog" p
                  WHERE p."lineId" = b."lineId"
                    AND LOWER(p."type") LIKE '%coin%'
                    AND p."amount" = b."amount"
                    AND ABS(EXTRACT(EPOCH FROM (p."createdAt" - b."createdAt"))) < 10
                )
              ORDER BY b."createdAt" DESC
              LIMIT $1
            `,
            keyword ? 1000 : 200
          )
          .catch(() => []),
    getAllLocalProfiles().catch(() => []),
  ]);

  const localProfileMap = new Map(
    localProfiles.map((profile) => [profile.userId, profile])
  );

  const mergedLogs = [...pointLogs, ...backupCoinLogs]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((log) => {
    const localProfile =
      (log.userId ? localProfileMap.get(log.userId) : null) ||
      localProfileMap.get(log.lineId);

    return {
      id: log.id,
      userId: log.userId,
      lineId: log.lineId,
      name: log.name,
      displayName: localProfile?.displayName || log.displayName,
      username: localProfile?.username || log.username,
      type: log.type,
      amount: Number(log.amount || 0),
      point: Number(log.point || 0),
      note: log.note || null,
      evidenceJson: log.evidenceJson || null,
      createdAt: log.createdAt.toISOString(),
    };
    });

  const filteredLogs = keyword
    ? mergedLogs.filter((log) => {
        const username = normalizeSearch(log.username || "");
        const fields = [
          log.name,
          log.displayName,
          log.lineId,
          log.userId,
          log.username,
          username ? `@${username}` : "",
        ]
          .map((value) => normalizeSearch(String(value || "")))
          .filter(Boolean);

        return fields.some((field) => field.includes(keyword));
      })
    : mergedLogs;

  const summary = filteredLogs.reduce(
    (acc, log) => {
      const currency = getLogCurrency(log);
      const value = getLogValue(log);

      if (currency === "COIN") {
        acc.coin += value;
        acc.coinCount += 1;
      } else {
        acc.nex += value;
        acc.nexCount += 1;
      }

      return acc;
    },
    { nex: 0, coin: 0, nexCount: 0, coinCount: 0 }
  );

  return (
    <div className="space-y-5 text-white">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">
          Admin Logs
        </div>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Point Logs</h1>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
            Showing
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            {filteredLogs.length.toLocaleString("th-TH")} Logs
          </div>
          <div className="mt-1 text-xs font-bold text-white/45">
            All means NEX + COIN
          </div>
        </div>
        <div className="rounded-[24px] border border-amber-300/15 bg-amber-300/10 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/60">
            NEX Movement
          </div>
          <div className="mt-2 text-2xl font-black text-amber-300">
            {summary.nex >= 0 ? "+" : ""}
            {summary.nex.toLocaleString("th-TH")} NEX
          </div>
          <div className="mt-1 text-xs font-bold text-amber-100/55">
            {summary.nexCount.toLocaleString("th-TH")} records
          </div>
        </div>
        <div className="rounded-[24px] border border-sky-300/15 bg-sky-300/10 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-100/60">
            COIN Movement
          </div>
          <div className="mt-2 text-2xl font-black text-sky-300">
            {summary.coin >= 0 ? "+" : ""}
            {summary.coin.toLocaleString("th-TH")} COIN
          </div>
          <div className="mt-1 text-xs font-bold text-sky-100/55">
            {summary.coinCount.toLocaleString("th-TH")} records
          </div>
        </div>
      </div>

      <form method="GET" className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search name, Line ID, @username"
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none placeholder:text-white/35"
        />
        <AutoSubmitSelect
          name="type"
          defaultValue={safeType}
        >
          <option value="all">ทั้งหมด NEX/COIN</option>
          <option value="nex">เฉพาะ NEX</option>
          <option value="coin">เฉพาะ COIN</option>
        </AutoSubmitSelect>
        <button
          type="submit"
          className="rounded-2xl bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-5 py-3 text-sm font-black text-black"
        >
          ค้นหา
        </button>
      </form>

      <PointLogsTable logs={filteredLogs.slice(0, 200)} />
    </div>
  );
}
