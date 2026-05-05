import { Apple, BadgeCheck } from "lucide-react";

const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL ||
  "https://apps.apple.com/search?term=NEX%20POINT";

export default function AppStoreButton() {
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noreferrer"
      className="pointer-events-auto group inline-flex min-h-[54px] items-center gap-3 overflow-hidden rounded-[22px] border border-black/12 bg-[linear-gradient(180deg,#fdfdfd_0%,#e8e8e8_100%)] px-5 py-3 text-sm font-black text-black shadow-[0_20px_46px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_26px_62px_rgba(0,0,0,0.22)]"
      aria-label="Open NEX POINT on the App Store"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-black/10 bg-black text-white">
        <Apple className="h-5 w-5 fill-current" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/54">
          Download on the
        </span>
        <span className="mt-1 tracking-[0.02em]">App Store</span>
      </span>
      <BadgeCheck className="h-4 w-4 text-black/46 transition group-hover:text-black" />
    </a>
  );
}
