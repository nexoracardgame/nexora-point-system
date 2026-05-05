export const BOX_PRODUCT_PUBLIC_DIR = "box-products";

export type BoxProductType = "box" | "pack";

export type BoxProductAsset = {
  name: string;
  url: string;
};

export type BoxMarketListing = {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerImage: string;
  title: string;
  productType: BoxProductType;
  description: string;
  price: number;
  quantity: number;
  imageName: string | null;
  imageUrl: string | null;
  status: string;
  isDealerVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DealerVerificationStatus = {
  verified: boolean;
  status: "none" | "verified";
  verifiedAt: string | null;
};
