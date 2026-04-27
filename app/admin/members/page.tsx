import { prisma } from "@/lib/prisma";
import MembersTable from "./MembersTable";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function MembersPage({ searchParams }: PageProps) {
  const { q = "" } = await searchParams;

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [{ name: { contains: q } }, { lineId: { contains: q } }],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">Admin Members</div>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">สมาชิกทั้งหมด</h1>
      </div>

      <form method="GET" className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="ค้นหาชื่อ หรือ Line ID"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition focus:border-amber-300/25"
        />
        <button
          type="submit"
          className="rounded-2xl bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-5 py-3 text-sm font-black text-black shadow-[0_0_24px_rgba(250,204,21,0.22)]"
        >
          ค้นหา
        </button>
      </form>

      <MembersTable
        users={users.map((user) => ({
          id: user.id,
          name: user.name,
          lineId: user.lineId,
          nexPoint: user.nexPoint,
          coin: user.coin,
          createdAt: user.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
