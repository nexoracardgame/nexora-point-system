import Link from "next/link";
import { Sparkles } from "lucide-react";
import MarketFeatureNav from "@/components/MarketFeatureNav";
import SellerCenterClient from "./SellerCenterClient";

export default function SellerCenterPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1b1830_0%,#090a10_55%,#05060a_100%)] px-3 py-4 text-white sm:px-6 sm:py-10">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-violet-400/10 p-3 text-violet-300">
              <Sparkles className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-5xl">
                Seller Center
              </h1>
              <p className="mt-1 text-xs text-white/50 sm:mt-2 sm:text-sm">
                จัดการโพสต์ขายการ์ดของคุณแบบมืออาชีพ
              </p>
            </div>
          </div>

          <Link
            href="/profile/me"
            className="w-fit rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-xs font-bold text-violet-300 transition hover:bg-violet-500/20 sm:px-5 sm:text-sm"
          >
            ดูโปรไฟล์ฉัน
          </Link>
        </div>

        <MarketFeatureNav className="mb-6 sm:mb-10" />

        <SellerCenterClient initialListings={[]} />
      </section>
    </div>
  );
}
