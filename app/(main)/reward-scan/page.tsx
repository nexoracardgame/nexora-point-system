import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import StaffCouponScanner from "@/app/staff/StaffCouponScanner";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RewardScanPage() {
  const session = await getServerSession(authOptions);
  const userId = String(
    (session?.user as { id?: string } | undefined)?.id || ""
  ).trim();

  if (!userId) {
    redirect("/login");
  }

  return <StaffCouponScanner mode="customer-admin-redemption" />;
}
