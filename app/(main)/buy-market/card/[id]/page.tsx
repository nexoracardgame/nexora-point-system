import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeDollarSign, UserRound } from "lucide-react";
import SafeCardImage from "@/components/SafeCardImage";
import BuyMarketFeatureNav from "@/components/BuyMarketFeatureNav";
import { getBuyMarketListingById } from "@/lib/buy-market";
import BuyMarketFollowButton from "./BuyMarketFollowButton";
import SellToBuyerButton from "./SellToBuyerButton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function formatPrice(value?: number | null) {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

export default async function BuyMarketCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getBuyMarketListingById(id);

  if (!listing) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 text-black">
      <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.20)] ring-1 ring-black/5">
        <div className="grid gap-0 lg:grid-cols-[420px_minmax(0,1fr)]">
          <div className="bg-[#f4f4f5] p-4 sm:p-5">
            <div className="overflow-hidden rounded-[26px] border border-black/8 bg-white">
              <SafeCardImage
                cardNo={listing.cardNo}
                imageUrl={listing.imageUrl || undefined}
                alt={listing.cardName || `Card #${listing.cardNo}`}
                className="aspect-[2.5/3.45] w-full object-cover"
              />
            </div>
          </div>

          <div className="flex flex-col justify-between gap-6 p-5 sm:p-7">
            <div>
              <Link
                href="/buy-market"
                className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-xs font-black text-black/60 transition hover:bg-black hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                กลับตลาดรับซื้อ
              </Link>

              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white">
                <BadgeDollarSign className="h-3.5 w-3.5" />
                BUY REQUEST
              </div>

              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">
                {listing.cardName || `Card #${listing.cardNo}`}
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-black/55">
                ผู้รับซื้อต้องการการ์ดใบนี้ หากคุณมีการ์ด สามารถเสนอขายเข้าดีลรับซื้อได้จากหน้านี้
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] bg-black p-4 text-white">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/44">
                    ราคารับซื้อ
                  </div>
                  <div className="mt-2 text-3xl font-black">
                    {formatPrice(listing.offerPrice)}
                  </div>
                </div>
                <div className="rounded-[22px] border border-black/8 bg-[#f4f4f5] p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/34">
                    Card No
                  </div>
                  <div className="mt-2 text-2xl font-black">#{listing.cardNo}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-[24px] border border-black/8 bg-[#f4f4f5] p-4 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={`/profile/${listing.buyerId}`}
                className="flex min-w-0 items-center gap-3 rounded-[20px] p-1 transition hover:bg-white"
              >
                <img
                  src={listing.buyerImage || "/avatar.png"}
                  alt={listing.buyerName}
                  className="h-12 w-12 rounded-2xl object-cover"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-black text-black/45">
                    <UserRound className="h-3.5 w-3.5" />
                    ผู้รับซื้อ
                  </div>
                  <div className="mt-1 truncate text-base font-black">
                    {listing.buyerName}
                  </div>
                </div>
              </Link>
              <div className="flex flex-col gap-2 sm:flex-row">
                <BuyMarketFollowButton listing={listing} />
                <SellToBuyerButton
                  listingId={listing.id}
                  defaultPrice={listing.offerPrice}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <BuyMarketFeatureNav />
    </div>
  );
}
