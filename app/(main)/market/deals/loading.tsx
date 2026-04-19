function DealCardSkeleton() {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 animate-pulse rounded-2xl bg-white/10" />
          <div className="space-y-2">
            <div className="h-3 w-28 animate-pulse rounded-full bg-white/10" />
            <div className="h-4 w-12 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
        <div className="h-8 w-28 animate-pulse rounded-full bg-white/10" />
      </div>

      <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-4">
        <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
        <div className="mt-3 h-8 w-36 animate-pulse rounded-full bg-white/10" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-white/[0.03] p-4">
          <div className="h-3 w-16 animate-pulse rounded-full bg-white/10" />
          <div className="mt-3 flex items-center gap-4">
            <div className="aspect-[2/3] w-20 animate-pulse rounded-2xl bg-white/10 sm:w-24" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-32 animate-pulse rounded-full bg-white/10" />
              <div className="h-4 w-16 animate-pulse rounded-full bg-white/10" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.03] p-4">
          <div className="h-3 w-20 animate-pulse rounded-full bg-white/10" />
          <div className="mt-3 flex items-center gap-3 rounded-2xl p-2">
            <div className="h-12 w-12 animate-pulse rounded-full bg-white/10" />
            <div className="h-5 w-32 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="h-3 w-28 animate-pulse rounded-full bg-white/10" />
        <div className="mt-3 h-12 w-full animate-pulse rounded-2xl bg-white/10" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#22114a_0%,#090b12_40%,#05070d_100%)] text-white">
      <div className="relative mx-auto max-w-7xl space-y-5 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6">
        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,18,48,0.98),rgba(11,12,18,0.92))] p-4 shadow-[0_25px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:rounded-[36px] sm:p-6 xl:p-7">
          <div className="h-4 w-36 animate-pulse rounded-full bg-white/10" />
          <div className="mt-4 h-10 w-56 animate-pulse rounded-full bg-white/10 sm:w-80" />
          <div className="mt-4 h-5 w-full max-w-2xl animate-pulse rounded-full bg-white/10" />

          <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-[320px]">
            <div className="h-24 animate-pulse rounded-[24px] bg-white/10" />
            <div className="h-24 animate-pulse rounded-[24px] bg-white/10" />
          </div>
        </section>

        <section>
          <div className="mb-4 h-8 w-56 animate-pulse rounded-full bg-white/10" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DealCardSkeleton />
            <DealCardSkeleton />
          </div>
        </section>
      </div>
    </div>
  );
}
