"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatThaiDateTime } from "@/lib/thai-time";
import { nexoraConfirm } from "@/lib/nexora-dialog";

type RewardRow = {
  id: string;
  name: string;
  imageUrl?: string | null;
  nexCost?: number | null;
  coinCost?: number | null;
  stock: number;
  createdAt: string;
};

const REWARD_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200";

function publishRewardsUpdated() {
  if (typeof window === "undefined") return;

  const timestamp = String(Date.now());
  window.dispatchEvent(new CustomEvent("nexora:rewards-updated"));

  try {
    window.localStorage.setItem("nexora:rewards-updated", timestamp);
    window.sessionStorage.removeItem("nexora:view:redeem-coupons");
  } catch {
    return;
  }
}

export default function RewardsTable({ rewards }: { rewards: RewardRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(rewards);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [nexCost, setNexCost] = useState("");
  const [coinCost, setCoinCost] = useState("");
  const [stock, setStock] = useState("");

  useEffect(() => {
    setRows(rewards);
  }, [rewards]);

  const startEdit = (reward: RewardRow) => {
    setEditingId(reward.id);
    setName(reward.name || "");
    setImageUrl(reward.imageUrl || "");
    setNexCost(reward.nexCost?.toString() || "");
    setCoinCost(reward.coinCost?.toString() || "");
    setStock(reward.stock.toString());
  };

  const closeEditor = () => {
    setEditingId(null);
    setName("");
    setImageUrl("");
    setNexCost("");
    setCoinCost("");
    setStock("");
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const rewardId = editingId;
    const previousRows = rows;
    const payload = {
      id: rewardId,
      name,
      imageUrl,
      nexCost: nexCost ? Number(nexCost) : null,
      coinCost: coinCost ? Number(coinCost) : null,
      stock: Number(stock),
    };

    setRows((prev) =>
      prev.map((reward) =>
        reward.id === rewardId
          ? {
              ...reward,
              name: name.trim() || reward.name,
              imageUrl: imageUrl.trim() || null,
              nexCost: payload.nexCost,
              coinCost: payload.coinCost,
              stock: Number.isFinite(payload.stock) ? payload.stock : 0,
            }
          : reward
      )
    );
    closeEditor();
    publishRewardsUpdated();

    try {
      const res = await fetch("/api/admin/reward/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setRows(previousRows);
        alert(data.error || "เธญเธฑเธเน€เธ”เธ•เธฃเธฒเธเธงเธฑเธฅเนเธกเนเธชเธณเน€เธฃเนเธ");
        return;
      }

      if (data?.reward) {
        setRows((prev) =>
          prev.map((reward) =>
            reward.id === rewardId
              ? {
                  ...reward,
                  ...data.reward,
                  createdAt:
                    typeof data.reward.createdAt === "string"
                      ? data.reward.createdAt
                      : reward.createdAt,
                }
              : reward
          )
        );
      }

      publishRewardsUpdated();
      router.refresh();
    } catch {
      setRows(previousRows);
      alert("เธญเธฑเธเน€เธ”เธ•เธฃเธฒเธเธงเธฑเธฅเนเธกเนเธชเธณเน€เธฃเนเธ");
    }
  };

  const deleteReward = async (reward: RewardRow) => {
    if (
      !(await nexoraConfirm({
        title: "ลบรางวัล",
        message: `ยืนยันลบรางวัล "${reward.name}" ?`,
        tone: "danger",
        confirmText: "ยืนยันลบ",
      }))
    ) {
      return;
    }

    const previousRows = rows;
    setRows((prev) => prev.filter((item) => item.id !== reward.id));
    publishRewardsUpdated();

    try {
      const res = await fetch("/api/admin/reward/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reward.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        setRows(previousRows);
        alert(data.error || "เธฅเธเนเธกเนเธชเธณเน€เธฃเนเธ");
        return;
      }

      router.refresh();
    } catch {
      setRows(previousRows);
      alert("เธฅเธเนเธกเนเธชเธณเน€เธฃเนเธ");
    }
  };

  return (
    <div className="grid gap-3">
      {rows.map((reward) => (
        <div
          key={reward.id}
          className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4"
        >
          <div className="flex flex-col gap-4 sm:flex-row">
            <img
              src={reward.imageUrl || REWARD_FALLBACK_IMAGE}
              alt={reward.name}
              className="h-28 w-full rounded-[22px] border border-white/8 bg-black/20 object-contain p-2 sm:h-32 sm:w-32"
              onError={(event) => {
                event.currentTarget.src = REWARD_FALLBACK_IMAGE;
              }}
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-black">{reward.name}</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-amber-300/12 bg-amber-300/10 p-3 text-amber-300">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-amber-100/70">
                    NEX
                  </div>
                  <div className="mt-1 font-black">
                    {reward.nexCost?.toLocaleString() || "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-sky-300/12 bg-sky-300/10 p-3 text-sky-300">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-sky-100/70">
                    COIN
                  </div>
                  <div className="mt-1 font-black">
                    {reward.coinCost?.toLocaleString() || "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-white/38">
                    STOCK
                  </div>
                  <div className="mt-1 font-black text-white">
                    {reward.stock}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-white/42">
                {formatThaiDateTime(reward.createdAt)}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(reward)}
                  className="rounded-2xl bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-4 py-3 text-sm font-black text-black"
                >
                  เนเธเนเนเธ
                </button>
                <button
                  type="button"
                  onClick={() => deleteReward(reward)}
                  className="rounded-2xl border border-red-400/18 bg-red-500/10 px-4 py-3 text-sm font-black text-red-300"
                >
                  เธฅเธ
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {editingId ? (
        <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <div className="w-full rounded-t-[28px] border border-white/10 bg-[#101118] p-4 sm:max-w-lg sm:rounded-[28px]">
            <h2 className="text-xl font-black">เนเธเนเนเธเธฃเธฒเธเธงเธฑเธฅ</h2>
            <div className="mt-4 space-y-3">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="เธเธทเนเธญเธฃเธฒเธเธงเธฑเธฅ"
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none"
              />
              <input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="เธฅเธดเธเธเนเธฃเธนเธเธฃเธฒเธเธงเธฑเธฅ"
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none"
              />
              <img
                src={imageUrl || REWARD_FALLBACK_IMAGE}
                alt={name || "preview"}
                className="h-44 w-full rounded-[22px] border border-white/10 bg-black/20 object-contain p-3"
                onError={(event) => {
                  event.currentTarget.src = REWARD_FALLBACK_IMAGE;
                }}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  value={nexCost}
                  onChange={(event) => setNexCost(event.target.value)}
                  placeholder="NEX"
                  type="number"
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none"
                />
                <input
                  value={coinCost}
                  onChange={(event) => setCoinCost(event.target.value)}
                  placeholder="COIN"
                  type="number"
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none"
                />
                <input
                  value={stock}
                  onChange={(event) => setStock(event.target.value)}
                  placeholder="Stock"
                  type="number"
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveEdit}
                  className="rounded-2xl bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-4 py-3 text-sm font-black text-black"
                >
                  เธเธฑเธเธ—เธถเธ
                </button>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-white"
                >
                  เธเธดเธ”
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
