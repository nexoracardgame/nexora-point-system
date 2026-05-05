import BuyDealsClient from "./BuyDealsClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function BuyDealsPage() {
  return <BuyDealsClient initialDeals={[]} />;
}
