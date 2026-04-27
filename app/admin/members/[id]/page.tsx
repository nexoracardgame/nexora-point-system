import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "@/lib/thai-time";
import MemberActions from "./MemberActions";

function Card({ title, value, gold }: { title: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">{title}</div>
      <div className={`mt-3 break-all text-xl font-black ${gold ? "text-amber-300" : "text-white"}`}>{value}</div>
    </div>
  );
}

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  const logs = await prisma.pointLog.findMany({
    where: { lineId: user.lineId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

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

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <Card title="ชื่อ" value={user.name || "-"} />
        <Card title="Line ID" value={user.lineId} />
        <Card title="NEX" value={String(user.nexPoint)} gold />
        <Card title="Coin" value={String(user.coin)} />
      </div>

      <MemberActions lineId={user.lineId} />

      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <h2 className="text-lg font-black sm:text-xl">ประวัติการเพิ่มแต้ม</h2>
        <div className="mt-4 grid gap-3">
          {logs.length === 0 ? (
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5 text-sm text-white/45">
              ยังไม่มีประวัติการเพิ่มแต้ม
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="grid gap-3 rounded-[22px] border border-white/8 bg-black/20 p-4 sm:grid-cols-[auto_auto_auto_1fr] sm:items-center">
                <span className="rounded-full border border-amber-300/18 bg-amber-300/10 px-3 py-1 text-xs font-black uppercase text-amber-300">{log.type}</span>
                <div className="text-sm font-bold text-white/75">จำนวน {log.amount}</div>
                <div className="text-sm font-black text-amber-300">+{log.point}</div>
                <div className="text-xs text-white/42 sm:text-right">{formatThaiDateTime(log.createdAt)}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
