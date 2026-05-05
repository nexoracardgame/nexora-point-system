export type BuyMarketListing = {
  id: string;
  cardNo: string;
  cardName: string | null;
  imageUrl: string | null;
  rarity: string | null;
  offerPrice: number;
  buyerId: string;
  buyerName: string;
  buyerImage: string;
  status: string;
  likes: number;
  views: number;
  createdAt: string;
};

export type BuyDealCard = {
  id: string;
  status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
  createdAt: string;
  offeredPrice: number;
  isBuyer: boolean;
  isResponder: boolean;
  buyer: {
    id: string;
    name: string;
    image: string;
  };
  seller: {
    id: string;
    name: string;
    image: string;
  };
  cardName: string;
  cardNo: string;
  cardImage: string;
  listingStatus: string;
};
