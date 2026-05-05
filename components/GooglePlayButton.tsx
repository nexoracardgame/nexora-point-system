import { Play, Smartphone } from "lucide-react";

const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.nexora.point";

export default function GooglePlayButton() {
  return (
    <a
      href={GOOGLE_PLAY_URL}
      target="_blank"
      rel="noreferrer"
      className="pointer-events-auto group inline-flex min-h-[54px] items-center gap-3 overflow-hidden rounded-[22px] border border-amber-300/28 bg-[linear-gradient(180deg,#fffdf7_0%,#f4ddb2_100%)] px-5 py-3 text-sm font-black text-black shadow-[0_20px_46px_rgba(120,82,20,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_26px_62px_rgba(120,82,20,0.26)]"
      aria-label="Open NEX POINT on Google Play"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-black/10 bg-black text-amber-200">
        <Play className="h-5 w-5 fill-current" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/54">
          GET IT ON
        </span>
        <span className="mt-1 tracking-[0.02em]">Google Play</span>
      </span>
      <Smartphone className="h-4 w-4 text-black/48 transition group-hover:text-black" />
    </a>
  );
}
