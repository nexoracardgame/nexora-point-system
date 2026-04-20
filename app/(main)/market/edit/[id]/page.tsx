import { getMarketListingById } from "@/lib/market-listings";
import { Coins, Sparkles, PencilLine } from "lucide-react";
import EditListingForm from "@/components/EditListingForm";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const listing = await getMarketListingById(id);

  let sheetCard: { card_name?: string | null } | null = null;
  try {
    if (!listing) {
      throw new Error("missing-listing");
    }

    const res = await fetch(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/card?cardNo=${listing?.cardNo}`,
      { next: { revalidate: 300 } }
    );
    sheetCard = await res.json();
  } catch {}

  if (!listing) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1b1830_0%,#090a10_55%,#05060a_100%)] p-6 text-white">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-white/[0.04] p-10 backdrop-blur-xl">
          ไม่พบโพสต์
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1b1830_0%,#090a10_55%,#05060a_100%)] px-6 py-10 text-white">
      <section className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center gap-4">
          <div className="rounded-3xl bg-violet-400/10 p-4 text-violet-300">
            <PencilLine className="h-7 w-7" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.45em] text-violet-300/80">
              NEXORA SELLER CONTROL
            </div>
            <h1 className="mt-2 text-5xl font-black tracking-tight">
              Edit Listing Price
            </h1>
            <p className="mt-2 text-sm text-white/50">
              ปรับราคาโพสต์ขายให้เหมาะกับตลาดแบบมืออาชีพ
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.04] shadow-[0_0_120px_rgba(139,92,246,0.12)] backdrop-blur-2xl">
          <div className="grid gap-0 lg:grid-cols-[360px_1fr]">
            <div className="relative border-b border-white/10 lg:border-b-0 lg:border-r">
              <img
                src={`/cards/${String(listing.cardNo).padStart(3, "0")}.jpg`}
                alt={`Card ${listing.cardNo}`}
                className="h-full min-h-[420px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-violet-300/80">
                  <Sparkles className="h-3.5 w-3.5" />
                  Listing Preview
                </div>

                <div className="mt-3 text-3xl font-black">
                  {sheetCard?.card_name || `Card #${String(listing.cardNo).padStart(3, "0")}`}
                </div>

                <div className="mt-2 text-sm text-white/60">
                  Serial protected in Seller Center
                </div>

                <div className="mt-4 flex items-center gap-2 text-lg font-black text-amber-300">
                  <Coins className="h-4 w-4" />
                  {Number(listing.price).toLocaleString()} NEX
                </div>
              </div>
            </div>

            <div className="p-8 lg:p-10">
              <div className="mb-6 rounded-3xl border border-violet-400/20 bg-violet-400/10 p-5">
                <div className="text-sm font-bold text-violet-300">
                  ปรับราคาโพสต์นี้
                </div>
                <div className="mt-1 text-sm text-white/60">
                  แนะนำตั้งราคาให้สัมพันธ์กับ rarity, serial และ demand ใน market
                </div>
              </div>

              <EditListingForm id={listing.id} price={listing.price} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
