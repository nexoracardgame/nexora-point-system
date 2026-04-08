import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { BadgeCheck, Gem, TrendingUp } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import DeleteListingButton from "@/components/DeleteListingButton";

export default async function SellerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const currentUserId = (session?.user as any)?.id;
  const isOwner = currentUserId === id;

  const seller = await prisma.user.findUnique({
    where: { id },
  });

  const listings = await prisma.marketListing.findMany({
    where: {
      sellerId: id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const completedDeals = await prisma.dealRequest.count({
    where: {
      sellerId: id,
      status: "accepted",
    },
  });

  const totalVolume = listings.reduce(
    (sum, item) => sum + Number(item.price),
    0
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1b1140_0%,#090b12_45%,#05070d_100%)] p-3 text-white sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        {/* HERO */}
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] shadow-[0_20px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:rounded-[40px]">
          <div className="relative h-[180px] overflow-hidden sm:h-[280px]">
            <img
              src={seller?.coverImage || "/seller-cover.jpg"}
              alt="Seller Cover"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090b12] via-black/30 to-transparent" />

            <div className="absolute right-3 top-3 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300 sm:right-6 sm:top-6 sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.18em]">
              VERIFIED
            </div>
          </div>

          <div className="relative px-4 pb-4 sm:px-8 sm:pb-8">
            <div className="-mt-12 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-5">
                <div className="relative">
                  <img
                    src={seller?.image || "/avatar.png"}
                    alt={seller?.name || "seller"}
                    className="h-20 w-20 rounded-full border-4 border-white object-cover shadow-2xl sm:h-28 sm:w-28"
                  />
                  <div className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-[#090b12] bg-emerald-400 sm:h-5 sm:w-5" />
                </div>

                <div className="pb-1 sm:pb-2">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-black leading-tight sm:text-4xl">
                      {seller?.name || "Unknown Seller"}
                    </h1>
                    <BadgeCheck className="h-5 w-5 text-emerald-300 sm:h-6 sm:w-6" />
                  </div>

                  <p className="mt-1 text-xs font-semibold text-emerald-300 sm:text-sm">
                    ● ELITE SELLER ONLINE
                  </p>
                </div>
              </div>

              <div className="w-full rounded-[22px] border border-violet-400/20 bg-violet-500/10 px-4 py-4 text-left sm:w-auto sm:rounded-3xl sm:px-5 sm:text-right">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/50 sm:text-xs sm:tracking-[0.2em]">
                  Seller Rank
                </div>
                <div className="mt-1 text-xl font-black text-violet-300 sm:text-2xl">
                  Genesis Elite
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 sm:grid-cols-4">
              <div className="rounded-[20px] bg-white/[0.04] p-4 sm:rounded-3xl sm:p-5">
                <div className="text-[10px] text-zinc-400 sm:text-xs">Deals</div>
                <div className="mt-2 text-2xl font-black text-emerald-300 sm:text-3xl">
                  {completedDeals}
                </div>
              </div>

              <div className="rounded-[20px] bg-white/[0.04] p-4 sm:rounded-3xl sm:p-5">
                <div className="text-[10px] text-zinc-400 sm:text-xs">Listings</div>
                <div className="mt-2 text-2xl font-black text-violet-300 sm:text-3xl">
                  {listings.length}
                </div>
              </div>

              <div className="rounded-[20px] bg-white/[0.04] p-4 sm:rounded-3xl sm:p-5">
                <div className="text-[10px] text-zinc-400 sm:text-xs">Volume</div>
                <div className="mt-2 text-2xl font-black text-amber-300 sm:text-3xl">
                  ฿{Number(totalVolume).toLocaleString("th-TH")}
                </div>
              </div>

              <div className="rounded-[20px] bg-white/[0.04] p-4 sm:rounded-3xl sm:p-5">
                <div className="text-[10px] text-zinc-400 sm:text-xs">Trust</div>
                <div className="mt-2 text-2xl font-black text-cyan-300 sm:text-3xl">
                  98%
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ACTIVE LISTINGS */}
        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_20px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:rounded-[40px] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-2xl font-black sm:text-3xl">🎴 การ์ดที่กำลังขาย</h2>
              <p className="mt-1 text-xs text-white/45 sm:text-sm">
                โปรไฟล์การ์ดสะสมและโพสต์ขายล่าสุด
              </p>
            </div>

            <div className="w-fit rounded-full bg-violet-500/10 px-4 py-2 text-xs font-bold text-violet-300 sm:text-sm">
              {listings.length} ACTIVE
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {listings.length > 0 ? (
              listings.map((item) => (
                <div
                  key={item.id}
                  className="group overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] transition duration-500 hover:-translate-y-1 hover:border-violet-400/30 hover:bg-white/[0.05] hover:shadow-[0_0_60px_rgba(139,92,246,0.15)] sm:rounded-[30px]"
                >
                  <Link href={`/market/card/${item.id}`}>
                    <div className="relative overflow-hidden">
                      <img
                        src={
                          item.imageUrl ||
                          `/cards/${String(item.cardNo).padStart(3, "0")}.jpg`
                        }
                        alt={String(item.cardNo)}
                        className="aspect-[2.5/3.5] w-full object-cover transition duration-500 group-hover:scale-105"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

                      <div className="absolute left-3 top-3 rounded-full bg-black/40 px-3 py-1 text-[10px] font-bold backdrop-blur-md sm:left-4 sm:top-4 sm:text-xs">
                        #{item.cardNo}
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                        <div className="text-xl font-black leading-tight sm:text-2xl">
                          {item.cardName ||
                            `Card #${String(item.cardNo).padStart(3, "0")}`}
                        </div>

                        <div className="mt-1 text-xs text-white/55 sm:text-sm">
                          Serial: {item.serialNo || "-"}
                        </div>

                        <div className="mt-3 flex items-center gap-2 text-lg font-black text-amber-300 sm:text-xl">
                          <Gem className="h-4 w-4" />
                          ฿{Number(item.price).toLocaleString("th-TH")}
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div
                    className={`grid gap-2 p-3 sm:gap-3 sm:p-4 ${
                      isOwner ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"
                    }`}
                  >
                    {isOwner && (
                      <>
                        <Link
                          href={`/market/edit/${item.id}`}
                          className="rounded-2xl bg-violet-500/10 px-4 py-3 text-center text-xs font-bold text-violet-300 transition hover:bg-violet-500/20 sm:text-sm"
                        >
                          ✏️ แก้ราคา
                        </Link>

                        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-2 py-2 transition hover:bg-red-500/20">
                          <DeleteListingButton id={item.id} />
                        </div>
                      </>
                    )}

                    <Link
                      href={`/market/card/${item.id}`}
                      className="rounded-2xl bg-white/[0.04] px-4 py-3 text-center text-xs font-bold text-white/80 transition hover:bg-white/[0.08] sm:text-sm"
                    >
                      👁 ดูการ์ด
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-6 text-sm text-zinc-400 sm:rounded-3xl sm:p-8">
                ยังไม่มีการ์ดที่กำลังขาย
              </div>
            )}
          </div>
        </section>

        {/* FOOTER */}
        <section className="rounded-[28px] border border-white/10 bg-gradient-to-r from-violet-500/10 to-amber-400/10 p-4 sm:rounded-[36px] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/50 sm:text-xs sm:tracking-[0.24em]">
                Reputation Score
              </div>
              <div className="mt-2 text-2xl font-black sm:text-4xl">
                Top 1% Seller
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-emerald-300 sm:text-base">
              <TrendingUp className="h-5 w-5" />
              Rising in market leaderboard
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}