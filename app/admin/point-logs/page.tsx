import { prisma } from "@/lib/prisma";
import PointLogsTable from "./PointLogsTable";

type PageProps = {
  searchParams: Promise<{ q?: string; type?: string }>;
};

export default async function PointLogsPage({ searchParams }: PageProps) {
  const { q = "", type = "all" } = await searchParams;
  const logs = await prisma.pointLog.findMany({
    where: {
      ...(q ? { lineId: { contains: q } } : {}),
      ...(type !== "all" ? { type } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-5 text-white">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">Admin Logs</div>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Point Logs</h1>
      </div>

      <form method="GET" className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
        <input type="text" name="q" defaultValue={q} placeholder="ค้นหา Line ID" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none" />
        <select name="type" defaultValue={type} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none">
          <option value="all">ทั้งหมด</option>
          <option value="bronze">bronze</option>
          <option value="silver">silver</option>
          <option value="gold">gold</option>
        </select>
        <button type="submit" className="rounded-2xl bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-5 py-3 text-sm font-black text-black">
          ค้นหา
        </button>
      </form>

      <PointLogsTable
        logs={logs.map((log) => ({
          id: log.id,
          lineId: log.lineId,
          type: log.type,
          amount: log.amount,
          point: log.point,
          createdAt: log.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
