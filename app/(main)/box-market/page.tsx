import BoxMarketClient from "./BoxMarketClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getBoxMarketSessionUser,
  resolveBoxMarketUserId,
} from "@/lib/box-market-auth";
import { getBoxProductAssets } from "@/lib/box-product-assets";
import {
  getBoxMarketListings,
  getBoxMarketListingsBySeller,
} from "@/lib/box-market-store";
import { resolveUserIdentity } from "@/lib/user-identity";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function BoxMarketPage() {
  const session = await getServerSession(authOptions);
  const sessionUser = getBoxMarketSessionUser(session);
  const identity = await resolveUserIdentity(session?.user);
  const currentUserId = await resolveBoxMarketUserId(sessionUser, identity);
  const role = String(
    (session?.user as { role?: string | null } | undefined)?.role || ""
  )
    .trim()
    .toLowerCase();
  const initialMyListingsPromise = currentUserId
    ? getBoxMarketListingsBySeller(currentUserId).catch(() => [])
    : Promise.resolve([]);

  const [initialListings, initialMyListings, productAssets] = await Promise.all([
    getBoxMarketListings().catch(() => []),
    initialMyListingsPromise,
    getBoxProductAssets(),
  ]);

  return (
    <BoxMarketClient
      initialListings={initialListings}
      initialMyListings={initialMyListings}
      productAssets={productAssets}
      currentUser={{
        id: currentUserId,
        name: identity.name,
        image: identity.image,
        isAdmin: role === "admin" || role === "gm" || role === "superadmin",
      }}
    />
  );
}
