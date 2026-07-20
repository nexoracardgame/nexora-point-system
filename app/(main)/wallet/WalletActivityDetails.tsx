"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Clock3, Sparkles, X } from "lucide-react";

export type WalletActivityDetailItem = {
  id: string;
  title: string;
  subtitle: string;
  createdAtLabel: string;
  createdAtFull: string;
  tone: "emerald" | "amber" | "cyan" | "white";
  category: string;
  status: string;
  amountLabel: string;
  detailRows: Array<{
    label: string;
    value: string;
  }>;
};

type WalletActivityDetailsProps = {
  items: WalletActivityDetailItem[];
};

function toneClasses(tone: WalletActivityDetailItem["tone"]) {
  switch (tone) {
    case "emerald":
      return {
        chip: "border-emerald-300/22 bg-emerald-300/12 text-emerald-200",
        glow: "from-emerald-300/28 via-cyan-300/12 to-transparent",
        icon: "bg-emerald-300 text-black",
      };
    case "amber":
      return {
        chip: "border-amber-200/24 bg-amber-200/12 text-amber-100",
        glow: "from-amber-200/30 via-rose-300/12 to-transparent",
        icon: "bg-amber-200 text-black",
      };
    case "cyan":
      return {
        chip: "border-cyan-200/24 bg-cyan-200/12 text-cyan-100",
        glow: "from-cyan-200/30 via-violet-300/12 to-transparent",
        icon: "bg-cyan-200 text-black",
      };
    default:
      return {
        chip: "border-white/14 bg-white/[0.07] text-white/75",
        glow: "from-white/16 via-white/8 to-transparent",
        icon: "bg-white text-black",
      };
  }
}

export default function WalletActivityDetails({
  items,
}: WalletActivityDetailsProps) {
  const [mounted, setMounted] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useMemo(
    () => items.find((item) => item.id === activeId) || null,
    [activeId, items]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveId(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active]);

  return (
    <>
      {items.length === 0 ? (
        <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.035] p-6 text-center text-sm leading-6 text-white/45">
          ยังไม่มีรายการให้ดูรายละเอียดในตอนนี้
        </div>
      ) : (
      <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10">
        {items.map((item) => {
          const tone = toneClasses(item.tone);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveId(item.id)}
              className="group grid w-full grid-cols-[1fr_auto] gap-3 border-b border-white/8 px-4 py-3 text-left transition hover:bg-white/[0.045] active:bg-white/[0.07] last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${tone.chip}`}
                  >
                    {item.category}
                  </span>
                  <div className="truncate font-bold text-white">
                    {item.title}
                  </div>
                </div>
                <div className="mt-1 line-clamp-2 text-sm leading-5 text-white/42">
                  {item.subtitle}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-right text-sm font-black text-white/78">
                <span>{item.createdAtLabel}</span>
                <ChevronRight className="h-4 w-4 opacity-45 transition group-hover:translate-x-0.5 group-hover:opacity-80" />
              </div>
            </button>
          );
        })}
      </div>
      )}

      {mounted && active
        ? createPortal(
            <div
              className="fixed inset-0 z-[5200] flex items-end justify-center overflow-y-auto bg-black/78 px-3 pb-[calc(12px_+_env(safe-area-inset-bottom))] pt-[calc(12px_+_env(safe-area-inset-top))] text-white backdrop-blur-xl sm:items-center sm:px-5 sm:py-6"
              role="dialog"
              aria-modal="true"
              onClick={() => setActiveId(null)}
            >
              <div
                className="relative w-full max-w-[620px] overflow-hidden rounded-t-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(20,20,30,0.98),rgba(8,8,13,0.99))] shadow-[0_32px_120px_rgba(0,0,0,0.62)] sm:rounded-[34px]"
                onClick={(event) => event.stopPropagation()}
              >
                <div
                  className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${
                    toneClasses(active.tone).glow
                  }`}
                />
                <div className="relative p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase ${
                            toneClasses(active.tone).chip
                          }`}
                        >
                          {active.category}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-black text-white/72">
                          {active.status}
                        </span>
                      </div>
                      <h2 className="mt-4 text-2xl font-black leading-tight text-white sm:text-3xl">
                        {active.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-white/56">
                        {active.subtitle}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveId(null)}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/70 transition hover:bg-white/[0.1] hover:text-white"
                      aria-label="ปิดรายละเอียดรายการ"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.045] p-4">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase text-white/42">
                        <Sparkles className="h-4 w-4" />
                        มูลค่า
                      </div>
                      <div className="mt-2 text-2xl font-black text-white">
                        {active.amountLabel || "-"}
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.045] p-4">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase text-white/42">
                        <Clock3 className="h-4 w-4" />
                        เวลา
                      </div>
                      <div className="mt-2 text-base font-black text-white">
                        {active.createdAtLabel}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-white/45">
                        {active.createdAtFull}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-black/18">
                    {active.detailRows.map((row) => (
                      <div
                        key={`${row.label}-${row.value}`}
                        className="grid gap-1 border-b border-white/8 px-4 py-3 last:border-b-0 sm:grid-cols-[150px_1fr] sm:gap-4"
                      >
                        <div className="text-xs font-bold uppercase tracking-[0.12em] text-white/36">
                          {row.label}
                        </div>
                        <div className="min-w-0 break-words text-sm font-semibold leading-6 text-white/82">
                          {row.value || "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
