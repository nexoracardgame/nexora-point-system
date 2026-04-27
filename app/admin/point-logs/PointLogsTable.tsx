"use client";

type PointLogRow = {
  id: string;
  lineId: string;
  type: string;
  amount: number;
  point: number;
  createdAt: string;
};

export default function PointLogsTable({ logs }: { logs: PointLogRow[] }) {
  return (
    <div className="grid gap-3">
      {logs.length === 0 ? (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 text-sm text-white/45">
          ไม่พบประวัติการเพิ่มแต้ม
        </div>
      ) : (
        logs.map((log) => (
          <div key={log.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <div className="grid gap-3 sm:grid-cols-[1.3fr_auto_auto_auto] sm:items-center">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">Line ID</div>
                <div className="mt-1 break-all text-sm font-bold text-white/86">{log.lineId}</div>
              </div>
              <span className="rounded-full border border-amber-300/18 bg-amber-300/10 px-3 py-1 text-xs font-black uppercase text-amber-300">{log.type}</span>
              <div className="text-sm font-bold text-white/78">จำนวน {log.amount}</div>
              <div className="text-sm font-black text-amber-300">+{log.point}</div>
            </div>
            <div className="mt-3 text-xs text-white/42">{new Date(log.createdAt).toLocaleString()}</div>
          </div>
        ))
      )}
    </div>
  );
}
