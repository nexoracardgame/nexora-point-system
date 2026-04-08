export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import DealActionButtons from "./DealActionButtons";

export default async function DealsPage() {
  const deals = await prisma.dealRequest.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-4 p-6 text-white">
      <h1 className="text-3xl font-black">🤝 Deal Requests</h1>

      {deals.map((deal) => (
        <div
          key={deal.id}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
        >
          <div className="space-y-1 text-sm">
            <div>Card: {deal.cardId}</div>
            <div>Buyer: {deal.buyerId}</div>
            <div>Offer: {deal.offeredPrice} NEX</div>
            <div>Status: {deal.status}</div>
          </div>

          {deal.status === "pending" && (
            <div className="mt-4">
              <DealActionButtons dealId={deal.id} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}