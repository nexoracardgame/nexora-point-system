"use client";

import { useMemo, useState, useTransition } from "react";
import { BadgeCheck, ChevronDown, MoreVertical, RotateCcw, Search } from "lucide-react";
import { useRouter } from "next/navigation";

export type PawnLedgerTableRow = {
  rowNumber: number;
  assetId: string;
  borrowerName: string;
  borrowerContact: string;
  cardLabel: string;
  cardCount: number;
  principalTHB: number;
  monthlyInterestRate: number;
  monthlyInterestTHB: number;
  maintenanceFeeTHB: number;
  totalDueTHB: number;
  pledgeDate: string;
  dueDate: string;
  status: string;
  note: string;
  staffName: string;
  updatedAt: string;
  overdueDays: number;
};

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

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toLocaleString("th-TH", { maximumFractionDigits: 2 })}%`;
}

function classifyRow(row: PawnLedgerTableRow) {
  const status = String(row.status || "");
  const closed = status.includes("ไถ่ถอน") || status.includes("ปิดบัญชี");
  const forfeited = status.includes("ปิดสิทธิ์") || status.includes("หลุด") || row.overdueDays > 7;
  const warning = !closed && !forfeited && row.overdueDays > 0 && row.overdueDays <= 7;

  if (forfeited) {
    return {
      label: "หมดสิทธิ์ไถ่ถอน",
      tone: "border-red-300/20 bg-red-500/12 text-red-100",
      rowTone: "border-l-red-400/70 bg-red-500/[0.05]",
      actionable: false,
      hint: "เกิน 7 วันแล้ว",
    };
  }

  if (closed) {
    return {
      label: "ไถ่ถอนเรียบร้อย",
      tone: "border-emerald-300/20 bg-emerald-400/12 text-emerald-100",
      rowTone: "border-l-emerald-400/60 bg-emerald-500/[0.05]",
      actionable: false,
      hint: "ปิดยอดแล้ว",
    };
  }

  if (warning) {
    const left = Math.max(0, 7 - row.overdueDays);
    return {
      label: `เหลือ ${left} วันก่อนหมดสิทธิ์`,
      tone: "border-amber-300/20 bg-amber-400/12 text-amber-100",
      rowTone: "border-l-amber-300/60 bg-amber-500/[0.05]",
      actionable: true,
      hint: "ใกล้ตัดสิทธิ์",
    };
  }

  return {
    label: status.includes("กำลัง") || status.includes("ใช้งาน") ? "กำลังใช้งาน" : "ปกติ",
    tone: "border-white/10 bg-white/[0.06] text-white/75",
    rowTone: "border-l-white/0 bg-white/[0.035]",
    actionable: true,
    hint: "ยังปกติ",
  };
}

export default function PawnLedgerTable({
  rows,
  sourceLabel,
}: {
  rows: PawnLedgerTableRow[];
  sourceLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [openRowId, setOpenRowId] = useState("");
  const [busyRowId, setBusyRowId] = useState("");
  const [message, setMessage] = useState("");

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.borrowerName, row.borrowerContact, row.cardLabel, row.note, String(row.rowNumber)]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [query, rows]);

  const runAction = async (row: PawnLedgerTableRow, action: "payment" | "redeem") => {
    if (!row.assetId) return;
    const state = classifyRow(row);
    if (!state.actionable) return;

    setBusyRowId(row.assetId);
    setMessage("");
    try {
      const response =
        action === "payment"
          ? await fetch(`/api/admin/card-bank/assets/${encodeURIComponent(row.assetId)}/pawn-action`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "payment",
                amountTHB: row.totalDueTHB,
                extendDays: 30,
                note: `ชำระดอกอัตโนมัติจากตาราง #${row.rowNumber}`,
              }),
            })
          : await fetch(`/api/admin/card-bank/assets/${encodeURIComponent(row.assetId)}/withdraw`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                quantity: row.cardCount,
                note: `ไถ่ถอนจากตาราง #${row.rowNumber}`,
              }),
            });

      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "ทำรายการไม่สำเร็จ");
      }

      setOpenRowId("");
      setMessage(action === "payment" ? "ชำระดอก / ต่ออายุสำเร็จแล้ว" : "ไถ่ถอนสำเร็จแล้ว");
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusyRowId("");
    }
  };

  return (
    <section className="w-full rounded-[28px] border border-white/10 bg-[#0b0d12] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">Live Table</div>
          <h2 className="mt-2 text-2xl font-black">ตารางรับฝากหลัก</h2>
          <div className="mt-2 text-sm text-white/50">แหล่งข้อมูล: {sourceLabel}</div>
        </div>
        <div className="relative w-full sm:w-[420px] xl:w-[520px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/34" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาชื่อการ์ด หรือชื่อผู้ฝาก"
            className="h-11 w-full rounded-[16px] border border-white/10 bg-black/40 pl-10 pr-3 text-sm font-bold text-white outline-none placeholder:text-white/30"
          />
        </div>
      </div>

      {message ? (
        <div className="mt-4 flex items-center gap-2 rounded-[16px] border border-white/10 bg-white/[0.04] p-3 text-sm font-bold text-white/72">
          <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-200" />
          <span>{message}</span>
        </div>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-[22px] border border-white/10 bg-black/20">
        <div className="max-h-[640px] overflow-auto">
          <div className="min-w-[1320px]">
            <div className="sticky top-0 z-20 grid grid-cols-[72px_148px_210px_258px_92px_132px_132px_132px_148px_154px_132px_180px_112px] bg-[#14171f]/98 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/38 backdrop-blur">
            <div>ลำดับ</div>
            <div>วันรับฝาก</div>
            <div>ชื่อผู้ฝาก</div>
            <div>การ์ดที่รับฝาก</div>
            <div>จำนวน</div>
            <div>เงินต้น</div>
            <div>ดอกเบี้ย</div>
            <div>ค่ารักษา</div>
            <div>ยอดจ่ายจริง</div>
            <div>วันครบกำหนด</div>
            <div>สถานะ</div>
            <div>หมายเหตุ</div>
            <div>จัดการ</div>
          </div>

          {filteredRows.length > 0 ? (
            filteredRows.map((row) => {
              const state = classifyRow(row);
              const expanded = openRowId === row.assetId;
              const busy = busyRowId === row.assetId || isPending;
              return (
                <div
                  key={`${row.rowNumber}-${row.assetId}`}
                    className={`grid grid-cols-[72px_148px_210px_258px_92px_132px_132px_132px_148px_154px_132px_180px_112px] items-start gap-0 border-t border-white/8 border-l-4 px-4 py-3 text-sm ${state.rowTone}`}
                >
                  <div className="font-black text-white">{row.rowNumber.toLocaleString("th-TH")}</div>
                  <div className="space-y-1 text-white/72">
                    <div className="font-bold text-white">{formatThaiDate(row.pledgeDate)}</div>
                    <div className="text-[11px] text-white/42">
                      {row.overdueDays > 0 ? `ล่าช้า ${row.overdueDays.toLocaleString("th-TH")} วัน` : "ยังไม่ครบกำหนด"}
                    </div>
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="truncate font-black text-white">{row.borrowerName}</div>
                    <div className="truncate text-xs text-white/45">{row.borrowerContact || "ไม่มีช่องทางติดต่อ"}</div>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="truncate font-bold text-white/90">{row.cardLabel}</div>
                    <div className="text-xs text-white/45">{row.note || "-"}</div>
                  </div>
                  <div className="font-black text-white">{row.cardCount.toLocaleString("th-TH")}</div>
                  <div className="font-black text-amber-100">{formatTHB(row.principalTHB)}</div>
                  <div className="space-y-1">
                    <div className="font-black text-white">{formatTHB(row.monthlyInterestTHB)}</div>
                    <div className="text-xs text-white/45">{formatPercent(row.monthlyInterestRate)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-black text-white">{formatTHB(row.maintenanceFeeTHB)}</div>
                    <div className="text-xs text-white/45">ค่ารักษา</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-black text-amber-100">{formatTHB(row.totalDueTHB)}</div>
                    <div className="text-xs text-white/45">ดอกเบี้ย + ค่ารักษา</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-white">{formatThaiDate(row.dueDate)}</div>
                    <div className="text-xs text-white/45">{row.overdueDays > 7 ? "ตัดสิทธิ์แล้ว" : row.overdueDays > 0 ? "เหลือช่วงผ่อนผัน" : "ยังปกติ"}</div>
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${state.tone}`}>
                      {state.label}
                    </span>
                  </div>
                  <div className="space-y-1 text-white/66">
                    <div className="leading-6">{row.note || "-"}</div>
                    <div className="text-[11px] text-white/38">
                      {row.staffName ? `โดย ${row.staffName}` : "ยังไม่ระบุผู้รับเรื่อง"}
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenRowId(expanded ? "" : row.assetId)}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[14px] border border-white/12 bg-white/[0.05] px-3 text-xs font-black text-white/82 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition hover:border-white/24 hover:bg-white/[0.08]"
                    >
                      <MoreVertical className="h-4 w-4" />
                      จัดการ
                      <ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} />
                    </button>
                    {expanded ? (
                      <div className="absolute right-0 top-[42px] z-10 w-[220px] rounded-[18px] border border-white/10 bg-[#11131a] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
                        <button
                          type="button"
                          disabled={busy || !state.actionable}
                          onClick={() => void runAction(row, "payment")}
                          className="flex h-10 w-full items-center justify-center gap-2 rounded-[14px] border border-emerald-200/20 bg-emerald-400/12 text-xs font-black text-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <RotateCcw className="h-4 w-4" />
                          ชำระดอก / ต่ออายุ
                        </button>
                        <button
                          type="button"
                          disabled={busy || !state.actionable}
                          onClick={() => void runAction(row, "redeem")}
                          className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-[14px] border border-sky-200/20 bg-sky-400/12 text-xs font-black text-sky-100 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <BadgeCheck className="h-4 w-4" />
                          ไถ่ถอน
                        </button>
                        {!state.actionable ? (
                          <div className="mt-2 rounded-[12px] border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-white/52">
                            {state.hint}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="border-t border-white/8 px-4 py-5 text-sm font-bold text-white/45">
              ไม่พบรายการที่ตรงกับคำค้น
            </div>
          )}
        </div>
      </div>
    </div>
  </section>
  );
}
