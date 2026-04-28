"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Coins,
  Gem,
  Gift,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import RewardRedeemButtons from "./RewardRedeemButtons";

type RewardItem = {
  id: string;
  name: string;
  imageUrl: string | null;
  nexCost: number | null;
  coinCost: number | null;
  stock: number;
};

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("th-TH");
}

function normalizeRewardName(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export default function RewardsShowcaseClient({
  displayName,
  profileImage,
  nexPoint,
  coin,
  rewards,
}: {
  displayName: string;
  profileImage: string;
  nexPoint: number;
  coin: number;
  rewards: RewardItem[];
}) {
  const [query, setQuery] = useState("");
  const [balances, setBalances] = useState({
    nexPoint: Number(nexPoint || 0),
    coin: Number(coin || 0),
  });

  useEffect(() => {
    setBalances({
      nexPoint: Number(nexPoint || 0),
      coin: Number(coin || 0),
    });
  }, [coin, nexPoint]);

  useEffect(() => {
    const handleBalanceUpdate = (
      event: Event
    ) => {
      const detail = (event as CustomEvent<{
        nexPoint?: number;
        coin?: number;
      }>).detail;

      if (!detail) {
        return;
      }

      setBalances((current) => ({
        nexPoint: Number(
          detail.nexPoint != null ? detail.nexPoint : current.nexPoint
        ),
        coin: Number(detail.coin != null ? detail.coin : current.coin),
      }));
    };

    window.addEventListener(
      "nexora:balance-updated",
      handleBalanceUpdate as EventListener
    );

    return () => {
      window.removeEventListener(
        "nexora:balance-updated",
        handleBalanceUpdate as EventListener
      );
    };
  }, []);

  const filteredRewards = useMemo(() => {
    const keyword = normalizeRewardName(query);

    if (!keyword) {
      return rewards;
    }

    const exact = rewards.filter(
      (reward) => normalizeRewardName(reward.name) === keyword
    );

    if (exact.length > 0) {
      return exact;
    }

    return rewards.filter((reward) =>
      normalizeRewardName(reward.name).includes(keyword)
    );
  }, [query, rewards]);

  const availableCount = rewards.filter((reward) => reward.stock > 0).length;

  return (
    <div className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(251,191,36,0.18),transparent_26%),radial-gradient(circle_at_0%_45%,rgba(124,58,237,0.16),transparent_24%),radial-gradient(circle_at_100%_75%,rgba(34,211,238,0.10),transparent_26%),linear-gradient(180deg,#0b0b10_0%,#050507_100%)]" />

      <div className="relative mx-auto max-w-7xl px-0 py-0 sm:px-5 sm:py-5 xl:px-6">
        <section className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.96))] px-3 pb-6 pt-5 shadow-[0_32px_120px_rgba(0,0,0,0.48)] sm:rounded-[48px] sm:px-7 sm:pb-8 xl:px-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_25%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_34%)]" />

          <div className="relative mx-auto max-w-6xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-12 w-12 overflow-hidden rounded-full border border-white/12 bg-white/8 shadow-[0_16px_40px_rgba(0,0,0,0.24)] sm:h-14 sm:w-14">
                  <Image
                    src={profileImage}
                    alt={displayName}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/38">
                    Nexora Vault
                  </div>
                  <div className="truncate text-base font-black sm:text-xl">
                    {displayName}
                  </div>
                </div>
              </div>

              <div className="rounded-full border border-amber-300/18 bg-amber-300/10 px-3 py-2 text-xs font-black text-amber-200 sm:px-4 sm:text-sm">
                {formatNumber(availableCount)} พร้อมแลก
              </div>
            </div>

            <div className="mt-8 text-center sm:mt-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-white/48 ring-1 ring-white/8">
                <Trophy className="h-3.5 w-3.5 text-amber-300" />
                Rewards
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.07em] sm:text-6xl lg:text-7xl">
                แลกรางวัล
              </h1>
            </div>

            <div className="relative mt-7">
              <div className="rounded-t-[40px] bg-white px-4 py-5 text-black shadow-[0_28px_70px_rgba(255,255,255,0.06)] sm:rounded-t-[56px] sm:px-7 sm:py-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-black/38">You Pay</div>
                    <div className="mt-5 flex items-center gap-3">
                      <div className="grid h-16 w-16 place-items-center rounded-full bg-[#f5bd22] shadow-[0_16px_32px_rgba(245,189,34,0.28)] sm:h-20 sm:w-20">
                        <Gem className="h-8 w-8 text-white sm:h-10 sm:w-10" />
                      </div>
                      <div>
                        <div className="text-2xl font-black sm:text-4xl">NEX</div>
                        <div className="mt-1 text-xs font-bold text-black/36">
                          Reward energy
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-2 text-xs font-black text-white sm:px-4">
                      <Gem className="h-3.5 w-3.5 text-amber-300" />
                      {formatNumber(balances.nexPoint)}
                    </div>
                    <div className="mt-5 text-3xl font-black tracking-[-0.06em] sm:text-5xl">
                      {formatNumber(balances.nexPoint)}
                    </div>
                    <div className="mt-1 text-xs font-bold text-black/38">
                      Available NEX
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative z-10 mx-auto -my-6 grid h-20 w-20 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#ffffff_0%,#f6e6a0_18%,#d1d5ff_42%,#151821_100%)] text-black shadow-[0_18px_46px_rgba(0,0,0,0.28)] ring-4 ring-white/70 sm:h-24 sm:w-24">
                <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.55),transparent_62%)] blur-md" />
                <div className="relative grid h-12 w-12 place-items-center rounded-full bg-black text-white sm:h-14 sm:w-14">
                  <Trophy className="h-6 w-6 text-amber-300 sm:h-7 sm:w-7" />
                </div>
              </div>

              <div className="rounded-b-[40px] bg-white px-4 py-5 text-black shadow-[0_28px_70px_rgba(255,255,255,0.06)] sm:rounded-b-[56px] sm:px-7 sm:py-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-black/38">You Receive</div>
                    <div className="mt-5 flex items-center gap-3">
                      <div className="grid h-16 w-16 place-items-center rounded-full bg-[#24b083] shadow-[0_16px_32px_rgba(36,176,131,0.24)] sm:h-20 sm:w-20">
                        <Coins className="h-8 w-8 text-white sm:h-10 sm:w-10" />
                      </div>
                      <div>
                        <div className="text-2xl font-black sm:text-4xl">COIN</div>
                        <div className="mt-1 text-xs font-bold text-black/36">
                          Coupon access
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-2 text-xs font-black text-white sm:px-4">
                      <Coins className="h-3.5 w-3.5 text-white" />
                      {formatNumber(balances.coin)}
                    </div>
                    <div className="mt-5 text-3xl font-black tracking-[-0.06em] sm:text-5xl">
                      {formatNumber(balances.coin)}
                    </div>
                    <div className="mt-1 text-xs font-bold text-black/38">
                      Available COIN
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm font-bold text-white/46">
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-orange-300" />
                  ทั้งหมด {formatNumber(rewards.length)} รายการ
                </span>
                <span className="hidden h-1 w-1 rounded-full bg-white/25 sm:block" />
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  ใช้ได้ทันทีหลังแลก
                </span>
              </div>

              <div className="mt-6 rounded-[36px] bg-black p-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
                <div className="flex min-h-[72px] items-center gap-3 rounded-[30px] px-3 text-white sm:px-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_20%,#fff,#c7d2fe_38%,#111827_100%)] text-black shadow-[0_16px_40px_rgba(255,255,255,0.12)]">
                    <Search className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/38">
                      Search Rewards
                    </div>
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="ค้นหาชื่อรางวัล"
                      className="mt-1 w-full bg-transparent text-lg font-black outline-none placeholder:text-white/40 sm:text-2xl"
                    />
                  </div>
                  <div className="hidden shrink-0 rounded-full bg-white/[0.06] px-4 py-2 text-xs font-black text-white/60 sm:block">
                    {formatNumber(filteredRewards.length)} ผลลัพธ์
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mt-4 px-3 pb-6 sm:px-0">
          {filteredRewards.length === 0 ? (
            <div className="rounded-[30px] border border-white/8 bg-white/[0.04] p-8 text-center text-sm font-bold text-white/45">
              ไม่พบรางวัลที่ค้นหา
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredRewards.map((reward) => (
                <article
                  key={reward.id}
                  className="group overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.96))] p-3 shadow-[0_18px_70px_rgba(0,0,0,0.36)] transition duration-500 hover:-translate-y-1 hover:border-amber-300/24 sm:p-4"
                >
                  <div className="relative overflow-hidden rounded-[28px] bg-white/[0.04] ring-1 ring-white/8">
                    <div className="absolute left-3 top-3 z-10 rounded-full bg-black/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/70 backdrop-blur-xl">
                      Stock {formatNumber(reward.stock)}
                    </div>
                    <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-amber-300/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200 ring-1 ring-amber-300/18">
                      Premium
                    </div>
                    <div className="relative aspect-[1.35]">
                      <Image
                        src={
                          reward.imageUrl ||
                          "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200"
                        }
                        alt={reward.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        className="object-contain p-5 transition duration-500 group-hover:scale-105"
                      />
                    </div>
                  </div>

                  <div className="px-1 pt-4">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/52 ring-1 ring-white/8">
                      <Star className="h-3.5 w-3.5 text-amber-300" />
                      Reward Drop
                    </div>
                    <h2 className="mt-3 line-clamp-2 min-h-[3.25rem] text-xl font-black leading-tight sm:text-2xl">
                      {reward.name}
                    </h2>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-[24px] bg-white px-3 py-4 text-black">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/38">
                          <Gem className="h-3.5 w-3.5 text-amber-500" />
                          NEX
                        </div>
                        <div className="mt-2 text-xl font-black tracking-[-0.04em]">
                          {reward.nexCost != null ? formatNumber(reward.nexCost) : "-"}
                        </div>
                      </div>

                      <div className="rounded-[24px] bg-white px-3 py-4 text-black">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/38">
                          <Coins className="h-3.5 w-3.5 text-emerald-500" />
                          COIN
                        </div>
                        <div className="mt-2 text-xl font-black tracking-[-0.04em]">
                          {reward.coinCost != null ? formatNumber(reward.coinCost) : "-"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <RewardRedeemButtons
                        rewardId={reward.id}
                        rewardName={reward.name}
                        stock={reward.stock}
                        userNexPoint={balances.nexPoint}
                        userCoin={balances.coin}
                        nexCost={reward.nexCost}
                        coinCost={reward.coinCost}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
