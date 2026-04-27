import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import StaffCouponScanner from "./StaffCouponScanner";
import { authOptions } from "@/lib/auth";
import { isStaffRole } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StaffPage() {
  const session = await getServerSession(authOptions);
  const role = String(
    (session?.user as { role?: string } | undefined)?.role || ""
  ).trim();

  if (!session?.user) {
    redirect("/login");
  }

  if (!isStaffRole(role)) {
    redirect("/");
  }

  return <StaffCouponScanner />;
}
