"use client";

import { useMemo } from "react";
import { History, ArrowUpRight } from "lucide-react";
import { type PawnLedgerTableRow } from "./PawnLedgerTable";

function formatThaiDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatThaiDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTHB(value: number) {
  return value.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  });
}

export default function PawnRedemptionHistoryTable({
  rows,
}: {
  rows: PawnLedgerTableRow[];
}) {
  const visibleRows = useMemo(
    () =>
      rows
        .slice()
        .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
        .slice(0, 10),
    [rows]
  );

  return (
    <section className="w-full rounded-[28px] border border-white/10 bg-[#0b0d12] p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/16 bg-emerald-300/[0.08] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-100/78">
            <History className="h-3.5 w-3.5" />
            Redemption History
          </div>
          <h2 className="mt-2 text-2xl font-black">เบิก / ถอนการ์ดรับฝากคืนลูกค้า</h2>
          <div className="mt-2 text-sm text-white/52">
            รายการบนสุดคือการไถ่ถอนล่าสุด, แสดง 10 รายการแรกก่อนแล้วค่อยเลื่อนเมาส์ดูรายการเก่า
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/55">
          ทั้งหมด {rows.length.toLocaleString("th-TH")} รายการ
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[22px] border border-white/10 bg-black/20">
        <div className="max-h-[560px] overflow-auto">
          <div className="min-w-[1180px]">
            <div className="sticky top-0 z-20 grid grid-cols-[88px_160px_1fr_120px_150px_180px_170px] bg-[#14171f]/98 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/38 backdrop-blur">
              <div>ลำดับ</div>
              <div>วันที่ไถ่ถอน</div>
              <div>ชื่อผู้ฝาก / การ์ด</div>
              <div>จำนวน</div>
              <div>เงินต้น</div>
              <div>ผู้ดำเนินการ</div>
              <div>หมายเหตุ</div>
            </div>

            {visibleRows.length > 0 ? (
              visibleRows.map((row) => (
                <div
                  key={`${row.assetId}-${row.updatedAt}`}
                  className="grid grid-cols-[88px_160px_1fr_120px_150px_180px_170px] items-start gap-0 border-t border-white/8 px-4 py-4 text-sm"
                >
                  <div className="font-black text-white">{row.rowNumber.toLocaleString("th-TH")}</div>
                  <div className="space-y-1">
                    <div className="font-bold text-emerald-100">{formatThaiDateTime(row.updatedAt)}</div>
                    <div className="text-[11px] text-white/40">ไถ่ถอนเรียบร้อย</div>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="truncate font-black text-white">{row.borrowerName}</div>
                    <div className="truncate text-xs text-white/45">{row.cardLabel}</div>
                    <div className="truncate text-[11px] text-white/38">
                      {formatThaiDate(row.pledgeDate)} | {row.borrowerContact || "ไม่มีช่องทางติดต่อ"}
                    </div>
                  </div>
                  <div className="font-black text-white">{row.cardCount.toLocaleString("th-TH")}</div>
                  <div className="font-black text-amber-100">{formatTHB(row.principalTHB)}</div>
                  <div className="space-y-1 text-white/68">
                    <div className="truncate font-bold text-white">{row.staffName || "-"}</div>
                    <div className="text-[11px] text-white/38">
                      <ArrowUpRight className="mr-1 inline-block h-3.5 w-3.5" />
                      ปิดยอดครบแล้ว
                    </div>
                  </div>
                  <div className="space-y-1 text-white/60">
                    <div className="leading-6">{row.note || "-"}</div>
                    <div className="text-[11px] text-white/38">{row.status}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="border-t border-white/8 px-4 py-5 text-sm font-bold text-white/45">
                ยังไม่มีรายการไถ่ถอนหรือถอนคืนที่ปิดยอดแล้ว
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
