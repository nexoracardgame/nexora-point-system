import { getLocalDealsForUser } from "@/lib/local-deal-store";

export type DealMember = {
  id: string;
  name: string;
  image: string;
};

export type DealCard = {
  id: string;
  status: "pending" | "accepted" | "rejected" | "completed";
  offeredPrice: number;
  isSeller: boolean;
  buyer: DealMember;
  seller: DealMember;
  cardName: string;
  cardNo: string;
  cardImage: string;
  listingStatus: string;
};

type DealStatus = DealCard["status"];

function safeMemberName(name?: string | null, fallback = "ผู้ใช้งาน") {
  const value = String(name || "").trim();
  return value || fallback;
}

function safeMemberImage(image?: string | null) {
  const value = String(image || "").trim();
  return value || "/avatar.png";
}

export async function getMarketDealsForUser(
  currentUserId: string
): Promise<DealCard[]> {
  const normalizedUserId = String(currentUserId || "").trim();

  if (!normalizedUserId) {
    return [];
  }

  const deals = await getLocalDealsForUser(normalizedUserId);

  return deals.map((deal) => ({
    id: deal.id,
    status: deal.status as DealStatus,
    offeredPrice: Number(deal.offeredPrice || 0),
    isSeller: normalizedUserId === deal.sellerId,
    buyer: {
      id: deal.buyerId,
      name: safeMemberName(deal.buyerName, "ผู้ซื้อ"),
      image: safeMemberImage(deal.buyerImage),
    },
    seller: {
      id: deal.sellerId,
      name: safeMemberName(deal.sellerName, "ผู้ขาย"),
      image: safeMemberImage(deal.sellerImage),
    },
    cardName: safeMemberName(deal.cardName, "การ์ดไม่พบข้อมูล"),
    cardNo: String(deal.cardNo || "001"),
    cardImage:
      String(deal.cardImage || "").trim() ||
      `/cards/${String(deal.cardNo || "001").padStart(3, "0")}.jpg`,
    listingStatus: String(deal.listingStatus || "active"),
  }));
}
