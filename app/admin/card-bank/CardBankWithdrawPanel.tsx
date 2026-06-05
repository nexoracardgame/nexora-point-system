"use client";

import { useMemo, useState, useTransition } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CardBankAsset } from "@/lib/card-bank-store";

type WithdrawState = {
  quantity: string;
  note: string;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function assetLabel(asset: CardBankAsset) {
  if (asset.intakeMode === "sets") {
    return asset.setName || asset.cardName;
  }
  if (asset.intakeMode === "bulk") {
    return "Bulk NEX / COIN Pool";
  }
  return asset.cardNo ? `No.${asset.cardNo} ${asset.cardName}` : asset.cardName;
}

export default function CardBankWithdrawPanel({ assets }: { assets: CardBankAsset[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyAssetId, setBusyAssetId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [forms, setForms] = useState<Record<string, WithdrawState>>({});

  const withdrawableAssets = useMemo(
    () =>
      assets.filter(
        (asset) =>
          asset.quantity > 0 &&
          (asset.status === "stored" || asset.status === "pawned") &&
          asset.intakeMode !== "bulk"
      ),
    [assets]
  );

  const updateForm = (assetId: string, patch: Partial<WithdrawState>) => {
    setForms((current) => ({
      ...current,
      [assetId]: {
        quantity: current[assetId]?.quantity || "1",
        note: current[assetId]?.note || "",
        ...patch,
      },
    }));
  };

  const withdrawAsset = async (asset: CardBankAsset) => {
    const form = forms[asset.id] || { quantity: "1", note: "" };
    const quantity = Math.max(1, Math.floor(Number(form.quantity || 1)));
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    if (quantity > asset.quantity) {
      setError(`จำนวนเบิกคืนมากกว่าคงเหลือของ ${assetLabel(asset)}`);
      return;
    }

    setBusyAssetId(asset.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/card-bank/assets/${asset.id}/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quantity,
          note: form.note,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        withdrawnQuantity?: number;
        remainingQuantity?: number;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Withdraw failed");
      }

      setSuccess(
        `เบิกคืน ${assetLabel(asset)} จำนวน ${result.withdrawnQuantity || quantity} สำเร็จ เหลือ ${result.remainingQuantity || 0}`
      );
      setForms((current) => ({
        ...current,
        [asset.id]: { quantity: "1", note: "" },
      }));
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Withdraw failed");
    } finally {
      setBusyAssetId("");
    }
  };

  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#101010,#050505)] p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">
            Return Desk
          </div>
          <h2 className="mt-2 text-2xl font-black">เบิก / ถอนการ์ดคืนลูกค้า</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/55">
          ลดจำนวนจริงและลง movement ทุกครั้ง
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-[18px] border border-red-300/20 bg-red-500/10 p-3 text-sm font-bold text-red-100">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mt-4 rounded-[18px] border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-100">
          {success}
        </div>
      ) : null}

      <div className="mt-5 overflow-x-auto rounded-[22px] border border-white/10">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[1fr_1fr_110px_130px_140px_190px] bg-white/[0.045] px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/38">
            <div>Owner</div>
            <div>Asset</div>
            <div>คงเหลือ</div>
            <div>จำนวนคืน</div>
            <div>สร้างเมื่อ</div>
            <div>Action</div>
          </div>
          {withdrawableAssets.length > 0 ? (
            withdrawableAssets.map((asset) => {
              const form = forms[asset.id] || { quantity: "1", note: "" };
              const busy = busyAssetId === asset.id || isPending;

              return (
                <div
                  key={asset.id}
                  className="grid grid-cols-[1fr_1fr_110px_130px_140px_190px] items-center gap-3 border-t border-white/8 px-4 py-4 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-black text-white">{asset.ownerName}</div>
                    <div className="truncate text-xs text-white/38">{asset.ownerLineId || asset.ownerId}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-bold text-white/82">{assetLabel(asset)}</div>
                    <div className="truncate text-xs text-white/38">
                      {asset.intakeMode === "sets"
                        ? `เซ็ต ${asset.setCardTotal || 0} ใบ / ${asset.nexValue.toLocaleString("th-TH")} NEX`
                        : asset.cardType || asset.intakeMode}
                    </div>
                    <input
                      value={form.note}
                      onChange={(event) => updateForm(asset.id, { note: event.target.value })}
                      placeholder="หมายเหตุการคืน"
                      className="mt-2 h-9 w-full rounded-[14px] border border-white/10 bg-black/30 px-3 text-xs font-bold text-white outline-none placeholder:text-white/32 focus:border-white/30"
                    />
                  </div>
                  <div className="font-black text-white">{asset.quantity.toLocaleString("th-TH")}</div>
                  <div>
                    <input
                      value={form.quantity}
                      onChange={(event) => updateForm(asset.id, { quantity: event.target.value })}
                      inputMode="numeric"
                      className="h-10 w-full rounded-[14px] border border-white/10 bg-black/30 px-3 text-sm font-black text-white outline-none focus:border-white/30"
                    />
                  </div>
                  <div className="text-white/52">{formatDateTime(asset.createdAt)}</div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => withdrawAsset(asset)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-[16px] bg-white px-3 text-sm font-black text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-500 disabled:text-zinc-900"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    เบิกคืนลูกค้า
                  </button>
                </div>
              );
            })
          ) : (
            <div className="border-t border-white/8 px-4 py-5 text-sm font-bold text-white/45">
              ยังไม่มีการ์ดหรือเซ็ตที่เบิกคืนได้
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
