import BuyCenterClient from "./BuyCenterClient";
import { getBuyMarketCurrentUser } from "@/lib/buy-market-auth";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function BuyCenterPage() {
  const user = await getBuyMarketCurrentUser();

  return (
    <BuyCenterClient
      initialListings={[]}
      currentUserId={user.id}
      isAdmin={user.isAdmin}
    />
  );
}
