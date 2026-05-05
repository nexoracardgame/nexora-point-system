import BuyMarketClient from "./BuyMarketClient";
import { getBuyMarketListings } from "@/lib/buy-market";
import { getBuyMarketCurrentUser } from "@/lib/buy-market-auth";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function BuyMarketPage() {
  const [initialListings, currentUser] = await Promise.all([
    getBuyMarketListings().catch(() => []),
    getBuyMarketCurrentUser().catch(() => ({
      id: "",
      name: "",
      image: "/avatar.png",
      role: "",
      isAdmin: false,
    })),
  ]);

  return (
    <BuyMarketClient
      initialListings={initialListings}
      currentUser={{
        id: currentUser.id,
        isAdmin: currentUser.isAdmin,
      }}
    />
  );
}
