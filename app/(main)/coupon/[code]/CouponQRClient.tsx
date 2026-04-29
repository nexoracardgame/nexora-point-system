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
    <div className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(251,191,36,0.18),transparent_26%),radial-gradient(circle_at_0%_45%,rgba(124,58,237,0.16),transparent_24%),radial-gradient(circle_at_100%_75%,rgba(34,211,238,0.10),transparent_26%),linear-gradient(180deg,#0b0b10_0%,#050507_100%)]" />

      <div className="relative mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 xl:px-6">
        <CouponDetailCard coupon={coupon} />
      </div>
    </div>
  );
}
