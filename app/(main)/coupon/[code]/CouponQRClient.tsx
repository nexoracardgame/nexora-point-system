"use client";

import { useCallback, useEffect, useState } from "react";
import CouponDetailCard, {
  type CouponViewModel,
} from "@/components/CouponDetailCard";

export default function CouponQRClient({
  coupon,
}: {
  coupon: CouponViewModel;
}) {
  const [liveCoupon, setLiveCoupon] = useState(coupon);

  useEffect(() => {
    setLiveCoupon(coupon);
  }, [coupon]);

  const syncCoupon = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/coupon/${encodeURIComponent(coupon.code)}?ts=${Date.now()}`,
        { cache: "no-store" }
      );

      if (!res.ok) return;

      const data = await res.json();
      if (data?.coupon) {
        setLiveCoupon(data.coupon);
      }
    } catch {
      return;
    }
  }, [coupon.code]);

  useEffect(() => {
    void syncCoupon();

    const onFocus = () => void syncCoupon();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void syncCoupon();
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "nexora:rewards-updated") {
        void syncCoupon();
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    window.addEventListener("nexora:rewards-updated", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncCoupon();
      }
    }, 6000);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("nexora:rewards-updated", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [syncCoupon]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#16192d_0%,#090b12_44%,#04060b_100%)] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.1),transparent_24%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 xl:px-6">
        <CouponDetailCard coupon={liveCoupon} />
      </div>
    </div>
  );
}
