export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import Link from "next/link";
import { Coins, Pencil, Sparkles } from "lucide-react";
import DeleteListingButton from "@/components/DeleteListingButton";
import { authOptions } from "@/lib/auth";
import { getLocalMarketListingsBySeller } from "@/lib/local-market-store";

export default async function SellerCenterPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1b1830_0%,#090a10_55%,#05060a_100%)] p-4 text-sm text-white sm:p-6">
        กรุณาเข้าสู่ระบบก่อน
      </div>
    );
  }

  let myListings: Array<{
    id: string;
    imageUrl: string | null;
    cardNo: string;
    cardName: string | null;
    serialNo: string | null;
    price: number;
  }> = [];

  myListings = (await getLocalMarketListingsBySeller(session.user.id)).map((item) => ({
    id: item.id,
    imageUrl: item.imageUrl,
    cardNo: item.cardNo,
    cardName: item.cardName,
    serialNo: item.serialNo,
    price: Number(item.price || 0),
  }));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1b1830_0%,#090a10_55%,#05060a_100%)] px-3 py-4 text-white sm:px-6 sm:py-10">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-violet-400/10 p-3 text-violet-300">
              <Sparkles className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-5xl">
                Seller Center
              </h1>
              <p className="mt-1 text-xs text-white/50 sm:mt-2 sm:text-sm">
                จัดการโพสต์ขายการ์ดของคุณแบบมืออาชีพ
              </p>
            </div>
          </div>

          <Link
            href="/profile/me"
            className="w-fit rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-xs font-bold text-violet-300 transition hover:bg-violet-500/20 sm:px-5 sm:text-sm"
          >
            ดูโปรไฟล์ฉัน
          </Link>
        </div>

        {myListings.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/50 backdrop-blur-xl sm:rounded-[32px] sm:p-10">
            ยังไม่มีโพสต์ขาย
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-8 xl:grid-cols-4">
            {myListings.map((item) => (
              <div key={item.id} className="group relative">
                <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.05] backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:border-violet-400/30 hover:shadow-[0_0_80px_rgba(139,92,246,0.18)] sm:rounded-[32px] sm:hover:-translate-y-2">
                  <Link
                    href={`/market/card/${item.id}`}
                    className="relative block aspect-[3/4] overflow-hidden"
                  >
                    <img
                      src={
                        item.imageUrl ||
                        `/cards/${String(item.cardNo).padStart(3, "0")}.jpg`
                      }
                      alt={`Card ${item.cardNo}`}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

                    <div className="absolute left-2 top-2 rounded-full border border-white/20 bg-black/50 px-2 py-1 text-[9px] font-semibold backdrop-blur-md sm:left-4 sm:top-4 sm:px-3 sm:text-xs">
                      #{item.cardNo}
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-5">
                      <div className="line-clamp-2 text-sm font-black leading-tight sm:text-2xl">
                        {item.cardName ||
                          `Card #${String(item.cardNo).padStart(3, "0")}`}
                      </div>

                      <div className="mt-1 text-[10px] text-white/60 sm:text-xs">
                        Serial: {item.serialNo || "-"}
                      </div>

                      <div className="mt-2 flex items-center gap-1 text-sm font-black text-amber-300 sm:mt-3 sm:gap-2 sm:text-lg">
                        <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        ฿{Number(item.price || 0).toLocaleString("th-TH")}
                      </div>
                    </div>
                  </Link>

                  <div className="grid grid-cols-2 gap-2 p-2 sm:gap-3 sm:p-4">
                    <Link
                      href={`/market/edit/${item.id}`}
                      className="flex items-center justify-center gap-1 rounded-2xl border border-blue-400/20 bg-blue-500/15 px-3 py-3 text-[11px] font-bold text-blue-300 transition hover:bg-blue-500/25 sm:gap-2 sm:px-4 sm:text-sm"
                    >
                      <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      แก้ราคา
                    </Link>

                    <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-1 py-1 transition hover:bg-red-500/20 sm:px-2 sm:py-2">
                      <DeleteListingButton id={item.id} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
