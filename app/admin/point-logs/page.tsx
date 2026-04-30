import { prisma } from "@/lib/prisma";
import { getAllLocalProfiles } from "@/lib/local-profile-store";
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
  createdAt: Date;
  userId: string | null;
  name: string | null;
  displayName: string | null;
  username: string | null;
};

function normalizeSearch(value: string) {
  return value.toLowerCase().trim().replace(/^@+/, "");
}

export default async function PointLogsPage({ searchParams }: PageProps) {
  const { q = "", type = "all" } = await searchParams;
  const keyword = normalizeSearch(q);
  const safeType = String(type || "all").trim() || "all";

  await prisma
    .$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT')
    .catch(() => undefined);

  const [logs, localProfiles] = await Promise.all([
    prisma.$queryRawUnsafe<PointLogWithUserRow[]>(
      `
        SELECT
          p."id",
          p."lineId",
          p."type",
          p."amount",
          p."point",
          p."createdAt",
          u."id" AS "userId",
          u."name",
          u."displayName",
          u."username"
        FROM "PointLog" p
        LEFT JOIN "User" u ON u."lineId" = p."lineId"
        WHERE ($1::text = 'all' OR p."type" = $1::text)
        ORDER BY p."createdAt" DESC
        LIMIT $2
      `,
      safeType,
      keyword ? 1000 : 200
    ),
    getAllLocalProfiles().catch(() => []),
  ]);

  const localProfileMap = new Map(
    localProfiles.map((profile) => [profile.userId, profile])
  );

  const mergedLogs = logs.map((log) => {
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

  return (
    <div className="space-y-5 text-white">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">
          Admin Logs
        </div>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Point Logs</h1>
      </div>

      <form method="GET" className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="ค้นหาชื่อ, Line ID, @username"
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none placeholder:text-white/35"
        />
        <select
          name="type"
          defaultValue={safeType}
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
        >
          <option value="all">ทั้งหมด</option>
          <option value="bronze">bronze</option>
          <option value="silver">silver</option>
          <option value="gold">gold</option>
        </select>
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
