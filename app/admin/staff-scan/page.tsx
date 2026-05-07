import StaffCouponScanner from "@/app/staff/StaffCouponScanner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminStaffScanPage() {
  return <StaffCouponScanner embedded />;
}
