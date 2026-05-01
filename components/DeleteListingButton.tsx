"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldAlert, Trash2, X } from "lucide-react";
import { emitMarketSync } from "@/lib/market-sync";

export default function DeleteListingButton({
  id,
  onDeleted,
  size = "default",
  label = "ลบ",
  title = "ยืนยันการลบการ์ด",
  description = "การ์ดใบนี้จะถูกลบออกจากตลาดและระบบดีลที่เกี่ยวข้องทันที การลบนี้ไม่สามารถย้อนกลับได้",
  redirectHref,
  adminMode = false,
  fitContent = false,
}: {
  id: string;
  onDeleted?: () => void;
  size?: "default" | "compact";
  label?: string;
  title?: string;
  description?: string;
  redirectHref?: string;
  adminMode?: boolean;
  fitContent?: boolean;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const sizeClass =
    size === "compact"
      ? "min-h-[34px] rounded-xl px-3 py-2 text-xs"
      : "min-h-[44px] rounded-2xl px-4 py-3 text-sm";
  const widthClass = fitContent
    ? "w-full sm:w-auto sm:min-w-[118px] sm:flex-none"
    : "w-full";
  const toneClass = adminMode
    ? "border border-red-300/24 bg-[linear-gradient(180deg,rgba(239,68,68,0.18),rgba(127,29,29,0.22))] text-red-100 shadow-[0_14px_34px_rgba(239,68,68,0.16)] hover:bg-red-500/24"
    : "bg-red-500/10 text-red-300 hover:bg-red-500/20";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || loading) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, open]);

  const deleteListing = async () => {
    if (loading) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/market/delete/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "ลบไม่สำเร็จ");
        return;
      }

      onDeleted?.();
      emitMarketSync({
        listingId: id,
        action: "deleted",
      });
      setOpen(false);

      window.setTimeout(() => {
        if (redirectHref) {
          router.push(redirectHref);
        } else {
          router.refresh();
        }
      }, 40);
    } finally {
      setLoading(false);
    }
  };

  const modal = open ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-5 sm:py-6">
          <button
            type="button"
            aria-label="ยกเลิก"
            className="absolute inset-0 bg-black/72 backdrop-blur-xl"
            onClick={() => {
              if (!loading) setOpen(false);
            }}
          />
          <div className="relative max-h-[calc(100dvh-32px)] w-full max-w-[460px] overflow-y-auto rounded-[26px] border border-white/12 bg-[#08080b] p-4 text-white shadow-[0_34px_120px_rgba(0,0,0,0.72)] sm:rounded-[30px] sm:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(248,113,113,0.22),transparent_34%),radial-gradient(circle_at_88%_16%,rgba(251,191,36,0.16),transparent_30%)]" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-300/20 bg-red-500/14 text-red-200 shadow-[0_0_34px_rgba(248,113,113,0.18)] sm:h-12 sm:w-12">
                    <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.28em] text-red-200/70">
                      DELETE CARD
                    </div>
                    <div className="mt-1 text-lg font-black leading-tight sm:text-xl">
                      {title}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!loading) setOpen(false);
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/78 transition hover:bg-white/[0.08]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="mt-4 text-sm font-semibold leading-6 text-white/64 sm:mt-5">
                {description}
              </p>

              <div className="mt-4 rounded-2xl border border-amber-200/12 bg-amber-300/10 px-4 py-3 text-xs font-bold leading-5 text-amber-100/82 sm:mt-5">
                ระบบจะลบห้องดีล ข้อความดีล การแจ้งเตือนดีล และซิงก์สถิติที่เกี่ยวข้องหลังลบทันที
              </div>

              <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="min-h-[46px] rounded-2xl border border-white/12 bg-white/[0.04] px-4 text-sm font-black text-white/80 transition hover:bg-white/[0.08] disabled:opacity-60"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => void deleteListing()}
                  disabled={loading}
                  className="min-h-[46px] rounded-2xl border border-red-300/24 bg-red-500 px-4 text-sm font-black text-white shadow-[0_18px_42px_rgba(239,68,68,0.28)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
                >
                  {loading ? "กำลังลบ..." : "ยืนยันลบถาวร"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading}
        className={`inline-flex items-center justify-center gap-2 text-center font-black transition-all duration-300 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 ${widthClass} ${toneClass} ${sizeClass}`}
      >
        <Trash2 className={size === "compact" ? "h-3.5 w-3.5" : "h-4 w-4"} />
        {loading ? "กำลังลบ..." : label}
      </button>

      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
