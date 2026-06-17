"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { BadgeCheck, CreditCard, FilePlus2, LockKeyhole } from "lucide-react";
import type { CardBankAsset } from "@/lib/card-bank-store";
import { getPawnChargeSummary } from "@/lib/pawn-terms";

type ActionMode = "payment" | "redeem";

function assetLabel(asset: CardBankAsset) {
  const name = asset.setName || asset.cardName || "รายการรับฝาก";
  const owner = asset.ownerName || asset.ownerLineId || asset.ownerId;
  return `${owner} - ${name} (${asset.quantity.toLocaleString("th-TH")})`;
}

function getPawnPaymentAmount(asset: CardBankAsset) {
  const source =
    asset.sourcePayload && typeof asset.sourcePayload === "object"
      ? asset.sourcePayload
      : {};
  const pawn =
    source && typeof source === "object" && "pawn" in source && typeof source.pawn === "object"
      ? (source.pawn as Record<string, unknown>)
      : {};
  const billing = getPawnChargeSummary(Number(pawn.principalTHB || asset.valueTHB || 0));
  return billing.totalDueTHB;
}

export default function PawnNextActions({ assets }: { assets: CardBankAsset[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const activeAssets = assets.filter((asset) => asset.status === "pawned");
  const [assetId, setAssetId] = useState(activeAssets[0]?.id || "");
  const [amountTHB, setAmountTHB] = useState("");
  const [extendDays, setExtendDays] = useState("30");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  const getSelectedAsset = () => activeAssets.find((asset) => asset.id === assetId) || null;
  const selectedAsset = getSelectedAsset();
  const suggestedPaymentTHB = selectedAsset ? getPawnPaymentAmount(selectedAsset) : 0;

  useEffect(() => {
    if (suggestedPaymentTHB > 0) {
      setAmountTHB(String(suggestedPaymentTHB));
    }
  }, [assetId, suggestedPaymentTHB]);

  const runAction = (action: ActionMode) => {
    if (!assetId) {
      setMessage("เลือกการ์ดรับฝากก่อน");
      return;
    }

    const selectedAsset = getSelectedAsset();
    if (!selectedAsset) {
      setMessage("ไม่พบรายการรับฝากที่เลือก");
      return;
    }

    setMessage("");
    startTransition(async () => {
      const paymentAmountTHB = Number(amountTHB || suggestedPaymentTHB || 0);
      const response =
        action === "payment"
          ? await fetch(`/api/admin/card-bank/assets/${encodeURIComponent(assetId)}/pawn-action`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "payment",
                amountTHB: paymentAmountTHB,
                extendDays: Number(extendDays || 30),
                note,
              }),
            })
          : await fetch(`/api/admin/card-bank/assets/${encodeURIComponent(assetId)}/withdraw`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                quantity: selectedAsset.quantity,
                note: note || "ไถ่ถอน",
              }),
            });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        setMessage(data.error || "ทำรายการไม่สำเร็จ");
        return;
      }

      setMessage(
        action === "payment"
          ? "ชำระดอก / ต่ออายุเรียบร้อย และซิงก์ข้อมูลไปทั่วระบบแล้ว"
          : "ไถ่ถอนเรียบร้อย และซิงก์ข้อมูลไปทั่วระบบแล้ว"
      );
      setAmountTHB("");
      setExtendDays("30");
      setNote("");
      router.refresh();
    });
  };

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">Next Phase</div>
          <h2 className="mt-2 text-2xl font-black">ส่วนถัดไปที่ควรต่อ</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/55">
          พร้อมต่อเป็น CRUD / อนุมัติ / ชำระดอกเบี้ย
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
          <FilePlus2 className="h-5 w-5 text-white/64" />
          <h3 className="mt-4 text-lg font-black text-white">ฟอร์มรับฝากการ์ด</h3>
          <p className="mt-2 text-sm leading-6 text-white/55">
            เพิ่มฟอร์มกรอกชื่อผู้ฝาก การ์ด จำนวน เงินต้น และดอกเบี้ยจากหน้าแอดมิน
          </p>
          <Link
            href="/admin/card-bank/create?mode=pawn"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-[16px] bg-white px-4 text-sm font-black text-black transition hover:bg-zinc-200"
          >
            เปิดฟอร์มรับฝาก
          </Link>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
          <CreditCard className="h-5 w-5 text-white/64" />
          <h3 className="mt-4 text-lg font-black text-white">ชำระดอก / ต่ออายุ / ไถ่ถอน</h3>
          <p className="mt-2 text-sm leading-6 text-white/55">
            ชำระดอกเบี้ยและเลื่อนครบกำหนดใช้ปุ่มเดียว ส่วนปิดยอดครบแล้วให้กดไถ่ถอนเพื่อคืนการ์ดและซิงก์ข้อมูล
          </p>
          <div className="mt-4 space-y-2">
            <select
              value={assetId}
              onChange={(event) => setAssetId(event.target.value)}
              className="h-11 w-full rounded-[16px] border border-white/10 bg-black/40 px-3 text-sm font-bold text-white outline-none"
            >
              {activeAssets.length === 0 ? (
                <option value="">ยังไม่มีรายการรับฝากที่ใช้งาน</option>
              ) : (
                activeAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {assetLabel(asset)}
                  </option>
                ))
              )}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={amountTHB}
                onChange={(event) => setAmountTHB(event.target.value)}
                inputMode="numeric"
                placeholder={suggestedPaymentTHB > 0 ? `ยอดมาตรฐาน ${suggestedPaymentTHB.toLocaleString("th-TH")} THB` : "ยอดชำระ THB"}
                className="h-11 rounded-[16px] border border-white/10 bg-black/40 px-3 text-sm font-bold text-white outline-none placeholder:text-white/30"
              />
              <input
                value={extendDays}
                onChange={(event) => setExtendDays(event.target.value)}
                inputMode="numeric"
                placeholder="ต่อกี่วัน"
                className="h-11 rounded-[16px] border border-white/10 bg-black/40 px-3 text-sm font-bold text-white outline-none placeholder:text-white/30"
              />
            </div>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="หมายเหตุ"
              className="h-11 w-full rounded-[16px] border border-white/10 bg-black/40 px-3 text-sm font-bold text-white outline-none placeholder:text-white/30"
            />
            <div className="text-[11px] font-bold tracking-[0.12em] text-white/42">
              มาตรฐานคำนวณ: ดอกเบี้ย 5% + ค่ารักษา 200 บาท = {suggestedPaymentTHB.toLocaleString("th-TH")} บาท
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isPending || !assetId}
                onClick={() => runAction("payment")}
                className="h-11 rounded-[16px] border border-emerald-200/20 bg-emerald-400/12 text-sm font-black text-emerald-100 disabled:opacity-45"
              >
                ชำระดอก / ต่ออายุ
              </button>
              <button
                type="button"
                disabled={isPending || !assetId}
                onClick={() => runAction("redeem")}
                className="h-11 rounded-[16px] border border-sky-200/20 bg-sky-400/12 text-sm font-black text-sky-100 disabled:opacity-45"
              >
                ไถ่ถอน
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-black/24 p-4">
          <LockKeyhole className="h-5 w-5 text-white/64" />
          <h3 className="mt-4 text-lg font-black text-white">สถานะไถ่ถอน</h3>
          <p className="mt-2 text-sm leading-6 text-white/55">
            เมื่อกดไถ่ถอน ระบบจะปิดยอด คืนการ์ด และซิงก์สถานะให้ทุกหน้าที่เชื่อมอยู่เห็นตรงกัน
          </p>
          {message ? (
            <div className="mt-4 flex gap-2 rounded-[16px] border border-white/10 bg-white/[0.04] p-3 text-sm font-bold text-white/70">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{message}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
