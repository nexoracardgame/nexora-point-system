"use client";

import { useEffect, useId, useState } from "react";
import { ChevronRight, Sparkles, Trophy, X } from "lucide-react";
import { SELLER_RANK_TIERS } from "@/lib/seller-rank-presentation";

export default function SellerRankGuideButton({
  currentRank,
}: {
  currentRank: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-amber-200/24 bg-amber-300/12 px-4 text-sm font-black text-amber-100 shadow-[0_18px_40px_rgba(245,158,11,0.14)] transition hover:-translate-y-0.5 hover:border-amber-100/38 hover:bg-amber-300/18 active:translate-y-0"
      >
        View rank guide
        <ChevronRight className="h-4 w-4" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/72 px-3 py-4 backdrop-blur-xl sm:items-center sm:px-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-amber-200/18 bg-[linear-gradient(180deg,rgba(16,12,6,0.98),rgba(4,4,6,0.98))] shadow-[0_36px_160px_rgba(0,0,0,0.72)] sm:rounded-[38px]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.05),transparent_38%)]" />
            <div className="relative flex items-start justify-between gap-4 border-b border-amber-200/10 px-5 py-5 sm:px-7">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/18 bg-amber-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-amber-100">
                  <Trophy className="h-3.5 w-3.5" />
                  Seller Rank System
                </div>
                <h2
                  id={titleId}
                  className="mt-3 text-2xl font-black tracking-[-0.04em] text-white sm:text-4xl"
                >
                  Every Rank, How To Earn It
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
                  Current rank:{" "}
                  <span className="font-black text-amber-100">{currentRank}</span>.
                  Scores combine completed deals, sales volume, reviews, active
                  listings, likes, and account history.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close rank guide"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative max-h-[68vh] overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              <div className="grid gap-3 md:grid-cols-2">
                {SELLER_RANK_TIERS.map((tier) => {
                  const active = tier.label === currentRank;

                  return (
                    <div
                      key={tier.label}
                      className={`relative overflow-hidden rounded-[22px] border p-4 sm:rounded-[26px] sm:p-5 ${tier.badge} ${
                        active ? "ring-2 ring-amber-100/30" : ""
                      }`}
                    >
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            <div className="text-lg font-black sm:text-xl">
                              {tier.label}
                            </div>
                          </div>
                          <div className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-white/52">
                            {tier.minScore === 0
                              ? "Starter rank"
                              : `${tier.minScore}+ score`}
                          </div>
                        </div>
                        {active ? (
                          <div className="rounded-full bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                            Current
                          </div>
                        ) : null}
                      </div>

                      <p className="mt-4 text-sm leading-6 text-white/74">
                        {tier.summary}
                      </p>
                      <p className="mt-3 rounded-2xl border border-white/10 bg-black/22 px-3 py-3 text-xs leading-5 text-white/58">
                        {tier.requirement}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
