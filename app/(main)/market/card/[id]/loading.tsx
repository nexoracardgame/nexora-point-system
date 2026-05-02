export default function MarketCardDetailLoading() {
  return (
    <div className="space-y-4 text-white md:space-y-6" aria-busy="true">
      <section className="overflow-hidden rounded-[22px] border border-white/5 bg-[#050507] px-4 py-4 shadow-[0_20px_80px_rgba(0,0,0,0.5)] md:px-6">
        <div className="h-5 w-36 rounded-full bg-white/8" />
        <div className="mt-6 h-12 w-full max-w-3xl rounded-2xl bg-white/7 md:h-20" />
        <div className="mt-4 flex gap-2">
          <div className="h-9 w-28 rounded-full bg-amber-300/10" />
          <div className="h-9 w-24 rounded-full bg-white/7" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] md:gap-6">
        <div className="rounded-[28px] border border-white/8 bg-[#090b10] p-3 md:rounded-[36px] md:p-5">
          <div className="mx-auto aspect-[2.5/3.5] w-full max-w-[460px] rounded-[32px] bg-white/7" />
        </div>

        <div className="space-y-4 md:space-y-6">
          <div className="rounded-[26px] border border-white/8 bg-white/[0.03] p-4 md:rounded-[34px] md:p-6">
            <div className="h-14 w-14 rounded-2xl bg-white/8" />
            <div className="mt-5 h-9 w-44 rounded-2xl bg-white/7" />
            <div className="mt-3 h-5 w-64 max-w-full rounded-xl bg-white/6" />
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="h-20 rounded-[18px] bg-white/6" />
              <div className="h-20 rounded-[18px] bg-white/6" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
