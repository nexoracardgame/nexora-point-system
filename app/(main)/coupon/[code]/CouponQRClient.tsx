"use client";

import CouponDetailCard, {
  type CouponViewModel,
} from "@/components/CouponDetailCard";

export default function CouponQRClient({
  coupon,
}: {
  coupon: CouponViewModel;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#16192d_0%,#090b12_44%,#04060b_100%)] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.1),transparent_24%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 xl:px-6">
        <CouponDetailCard coupon={coupon} />
      </div>
    </div>
  );
}
