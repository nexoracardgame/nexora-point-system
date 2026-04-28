export default function CollectionsLoading() {
  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#080808]">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 xl:px-6">
        <div className="overflow-hidden rounded-[30px] bg-white shadow-[0_28px_90px_rgba(50,43,33,0.12)] ring-1 ring-black/5 sm:rounded-[44px]">
          <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="min-h-[420px] bg-[#080808] p-6 sm:p-8 lg:p-10">
              <div className="h-9 w-48 animate-pulse rounded-full bg-white/16" />
              <div className="mt-6 h-16 w-[72%] animate-pulse rounded bg-white/12" />
              <div className="mt-4 h-5 w-[84%] animate-pulse rounded bg-white/10" />
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-[24px] bg-white/10"
                  />
                ))}
              </div>
            </div>
            <div className="bg-[#f8f6ef] p-4 sm:p-6 lg:p-7">
              <div className="h-full min-h-[360px] animate-pulse rounded-[28px] bg-white ring-1 ring-black/5" />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-5">
            <div className="h-[310px] animate-pulse rounded-[30px] bg-white ring-1 ring-black/5" />
            <div className="h-[270px] animate-pulse rounded-[30px] bg-black/90" />
          </div>
          <div className="space-y-5">
            <div className="h-[460px] animate-pulse rounded-[30px] bg-white ring-1 ring-black/5" />
            <div className="h-[420px] animate-pulse rounded-[30px] bg-black/90" />
          </div>
        </div>
      </div>
    </div>
  );
}
