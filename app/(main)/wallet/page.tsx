"use client";

import { useSession } from "next-auth/react";

function timeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}

export default function WalletPage() {
  const { data: session } = useSession();

  const activities = [
    {
      text: "รับแต้มจาก Silver Card +10",
      color: "text-emerald-400",
      createdAt: "2026-04-03T15:20:00",
    },
    {
      text: "ซื้อ Infernal Flame #A102 -450 NEX",
      color: "text-rose-400",
      createdAt: "2026-04-03T15:10:00",
    },
    {
      text: "เข้าร่วม Marathon Legends",
      color: "text-amber-400",
      createdAt: "2026-04-03T14:00:00",
    },
  ];

  return (
    <div className="space-y-6 text-white">
      {/* header */}
      <section className="rounded-[30px] border border-white/10 bg-gradient-to-br from-violet-600/15 to-black p-6">
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">
          NEXORA WALLET
        </p>
        <h1 className="mt-2 text-3xl font-black md:text-5xl">
          สวัสดี {session?.user?.name || "Duelist"} 👋
        </h1>
        <p className="mt-2 text-sm text-white/60">
          กระเป๋าแต้มสะสมและประวัติการใช้งานทั้งหมดของคุณ
        </p>
      </section>

      {/* stats */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-violet-600/20 to-black p-6">
          <p className="text-sm text-zinc-400">แต้มสะสมทั้งหมด</p>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-6xl font-black text-amber-300">
              {(session?.user?.nexPoint ?? 0).toLocaleString()}
            </span>
            <span className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-lg font-bold text-amber-200">
              NEX
            </span>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-fuchsia-600/20 to-black p-6">
          <p className="text-sm text-zinc-400">เหรียญของคุณ</p>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-6xl font-black text-fuchsia-300">
              {(session?.user?.coin ?? 0).toLocaleString()}
            </span>
            <span className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-2 py-1 text-lg font-bold text-fuchsia-200">
              COIN
            </span>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-amber-500/20 to-black p-6">
          <p className="text-sm text-zinc-300">Reward Progress</p>
          <p className="mt-3 text-3xl font-black">Next Goal: 500 NEX</p>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-500"
              style={{
                width: `${Math.min(
                  ((session?.user?.nexPoint ?? 0) / 500) * 100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>
      </section>

      {/* activity */}
      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6">
        <h3 className="mb-4 text-2xl font-black">ประวัติการใช้งานล่าสุด</h3>

        <div className="space-y-3">
          {activities.map((item, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm leading-relaxed">{item.text}</span>
                <span className={`${item.color} text-xs font-bold`}>
                  {timeAgo(item.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}