"use client";

import Link from "next/link";
import { formatThaiDateTime } from "@/lib/thai-time";

type PointLogRow = {
  id: string;
  userId: string | null;
  lineId: string;
  name: string | null;
  displayName: string | null;
  username: string | null;
  type: string;
  amount: number;
  point: number;
  createdAt: string;
};

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("th-TH");
}

function formatSignedNumber(value: number) {
  return `${value >= 0 ? "+" : ""}${formatNumber(value)}`;
}

function getLogDisplay(log: PointLogRow) {
  const type = String(log.type || "").trim().toLowerCase();
  const isCoin = type.includes("coin");
  const currency = isCoin ? "COIN" : "NEX";
  const value = isCoin ? Number(log.amount || 0) : Number(log.point || 0);

  if (type === "coupon_rollback_coin" || type === "coupon_rollback_nex") {
    return {
      typeLabel: "COUPON ROLLBACK",
      amountLabel: `Refund ${formatNumber(Math.abs(value))} ${currency}`,
      valueLabel: `${formatSignedNumber(value)} ${currency}`,
      valueClass: isCoin ? "text-sky-300" : "text-amber-300",
      badgeClass: isCoin
        ? "border-sky-300/18 bg-sky-300/10 text-sky-300"
        : "border-amber-300/18 bg-amber-300/10 text-amber-300",
    };
  }

  if (type === "admin_coin") {
    return {
      typeLabel: "ADMIN COIN",
      amountLabel: `${value >= 0 ? "Add" : "Deduct"} ${formatNumber(Math.abs(value))} COIN`,
      valueLabel: `${formatSignedNumber(value)} COIN`,
      valueClass: "text-sky-300",
      badgeClass: "border-sky-300/18 bg-sky-300/10 text-sky-300",
    };
  }

  if (type === "admin") {
    return {
      typeLabel: "ADMIN NEX",
      amountLabel: `${value >= 0 ? "Add" : "Deduct"} ${formatNumber(Math.abs(value))} NEX`,
      valueLabel: `${formatSignedNumber(value)} NEX`,
      valueClass: "text-amber-300",
      badgeClass: "border-amber-300/18 bg-amber-300/10 text-amber-300",
    };
  }

  return {
    typeLabel: type ? type.toUpperCase() : "POINT LOG",
    amountLabel: isCoin
      ? `${formatNumber(Math.abs(value))} COIN`
      : `${formatNumber(log.amount)} cards`,
    valueLabel: `${formatSignedNumber(value)} ${currency}`,
    valueClass: isCoin ? "text-sky-300" : "text-amber-300",
    badgeClass: isCoin
      ? "border-sky-300/18 bg-sky-300/10 text-sky-300"
      : "border-amber-300/18 bg-amber-300/10 text-amber-300",
  };
}

export default function PointLogsTable({ logs }: { logs: PointLogRow[] }) {
  return (
    <div className="grid gap-3">
      {logs.length === 0 ? (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 text-sm text-white/45">
          No point logs found.
        </div>
      ) : (
        logs.map((log) => {
          const displayName = log.displayName || log.name || "Unknown member";
          const username = String(log.username || "").trim().replace(/^@+/, "");
          const logDisplay = getLogDisplay(log);

          return (
            <div
              key={log.id}
              className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1.45fr)_auto_auto_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                    Member
                  </div>
                  {log.userId ? (
                    <Link
                      href={`/admin/members/${log.userId}`}
                      className="mt-1 block truncate text-base font-black text-white hover:text-amber-300"
                    >
                      {displayName}
                    </Link>
                  ) : (
                    <div className="mt-1 truncate text-base font-black text-white">
                      {displayName}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="break-all rounded-full bg-white/[0.05] px-3 py-1 text-xs font-bold text-white/52 ring-1 ring-white/10">
                      {log.lineId}
                    </div>
                    {username ? (
                      <div className="break-all rounded-full bg-amber-300/12 px-3 py-1 text-xs font-black text-amber-200 ring-1 ring-amber-300/20">
                        @{username}
                      </div>
                    ) : null}
                  </div>
                </div>

                <span
                  className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase ${logDisplay.badgeClass}`}
                >
                  {logDisplay.typeLabel}
                </span>
                <div className="text-sm font-bold text-white/78">
                  {logDisplay.amountLabel}
                </div>
                <div className={`text-sm font-black ${logDisplay.valueClass}`}>
                  {logDisplay.valueLabel}
                </div>
              </div>
              <div className="mt-3 text-xs text-white/42">
                {formatThaiDateTime(log.createdAt)}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
