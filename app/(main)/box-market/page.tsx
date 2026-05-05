import BoxMarketClient from "./BoxMarketClient";
import { getBoxProductAssets } from "@/lib/box-product-assets";
import { getBoxMarketListings } from "@/lib/box-market-store";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function BoxMarketPage() {
  const [initialListings, productAssets] = await Promise.all([
    getBoxMarketListings().catch(() => []),
    getBoxProductAssets(),
  ]);

  return (
    <BoxMarketClient
      initialListings={initialListings}
      productAssets={productAssets}
    />
  );
}
