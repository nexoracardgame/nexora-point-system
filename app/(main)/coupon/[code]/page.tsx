import Link from "next/link";

type PageProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function CouponPage({ params }: PageProps) {
  const { code } = await params;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#13243c_0%,#090b12_45%,#04060b_100%)] text-white">
      <div className="mx-auto max-w-4xl px-3 py-6 sm:px-5 xl:px-6">
        <section className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-5 shadow-[0_25px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:rounded-[34px] sm:p-8">
          <div className="inline-flex rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200 sm:text-xs">
            COUPON PLACEHOLDER
          </div>

          <h1 className="mt-4 text-3xl font-black sm:text-4xl">
            ระบบคูปองเดิมถูกปิดแล้ว
          </h1>

          <p className="mt-3 text-sm leading-6 text-white/65 sm:text-base sm:leading-7">
            ลิงก์คูปองเก่ายังถูกคงไว้เพื่อไม่ให้ลิงก์แตก แต่ข้อมูลคูปองจาก DB เก่าถูกตัดออกจากระบบแล้ว
            ระหว่างรอเชื่อมระบบคูปองชุดใหม่ คุณจะไม่เห็นข้อมูลคูปองจริงจากหน้านี้
          </p>

          <div className="mt-5 rounded-[22px] border border-white/8 bg-black/20 p-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">
              Coupon Code
            </div>
            <div className="mt-2 break-all text-base font-black">{code}</div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/redeem"
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-black transition hover:scale-[1.01]"
            >
              กลับไปหน้า Redeem
            </Link>

            <Link
              href="/rewards"
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/[0.09]"
            >
              ไปหน้ารางวัล
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
