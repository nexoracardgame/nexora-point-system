function AssetCardSkeleton() {
  return (
    <div className="rounded-[28px] border border-white/8 bg-white/[0.04] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 animate-pulse rounded-2xl bg-white/10" />
          <div className="space-y-2">
            <div className="h-6 w-36 animate-pulse rounded-full bg-white/10" />
            <div className="h-4 w-40 animate-pulse rounded-full bg-white/[0.08]" />
          </div>
        </div>
        <div className="h-8 w-28 animate-pulse rounded-full bg-white/10" />
      </div>
    </div>
  );
}

export default function WalletLoading() {
  return (
    <div className="min-h-screen bg-[#090909] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.16),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.1),transparent_18%),linear-gradient(180deg,#090909_0%,#0b0b0d_42%,#101119_100%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 xl:px-6">
        <section className="mx-auto max-w-5xl">
          <div className="rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(14,14,16,0.98),rgba(18,18,22,0.94))] p-4 shadow-[0_30px_120px_rgba(0,0,0,0.48)] sm:p-6 xl:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="h-4 w-28 animate-pulse rounded-full bg-white/10" />
                <div className="mt-4 h-10 w-56 animate-pulse rounded-full bg-white/10 sm:w-72" />
              </div>
              <div className="h-14 w-14 animate-pulse rounded-[22px] bg-white/10 sm:h-16 sm:w-48" />
            </div>

            <div className="mt-5 flex flex-wrap gap-2 sm:gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[42px] w-24 animate-pulse rounded-full bg-white/10"
                />
              ))}
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[30px] border border-white/8 bg-white/[0.05] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="h-5 w-40 animate-pulse rounded-full bg-white/10" />
                    <div className="h-3 w-32 animate-pulse rounded-full bg-white/[0.08]" />
                  </div>
                  <div className="h-4 w-32 animate-pulse rounded-full bg-white/[0.08]" />
                </div>

                <div className="mt-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-3">
                    <div className="h-14 w-44 animate-pulse rounded-full bg-white/10" />
                    <div className="h-6 w-32 animate-pulse rounded-full bg-white/[0.08]" />
                    <div className="flex flex-wrap gap-3">
                      <div className="h-10 w-32 animate-pulse rounded-full bg-white/10" />
                      <div className="h-10 w-32 animate-pulse rounded-full bg-white/10" />
                      <div className="h-10 w-28 animate-pulse rounded-full bg-white/10" />
                    </div>
                  </div>

                  <div className="h-[150px] w-full max-w-[240px] animate-pulse rounded-[28px] bg-white/10" />
                </div>

                <div className="mt-6 h-14 animate-pulse rounded-[24px] bg-white/[0.08]" />
              </div>

              <div className="grid gap-3">
                <div className="h-[152px] animate-pulse rounded-[28px] bg-white/[0.06]" />
                <div className="h-[152px] animate-pulse rounded-[28px] bg-white/[0.06]" />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-6 grid max-w-5xl gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
                <div className="h-8 w-48 animate-pulse rounded-full bg-white/10" />
              </div>
              <div className="h-10 w-28 animate-pulse rounded-full bg-white/10" />
            </div>

            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <AssetCardSkeleton key={index} />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[30px] border border-white/8 bg-white/[0.04] p-5">
              <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
              <div className="mt-3 h-8 w-40 animate-pulse rounded-full bg-white/10" />
              <div className="mt-5 space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-[24px] bg-white/[0.06]"
                  />
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/8 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
                  <div className="mt-3 h-8 w-40 animate-pulse rounded-full bg-white/10" />
                </div>
                <div className="h-10 w-20 animate-pulse rounded-full bg-white/10" />
              </div>
              <div className="mt-5 space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-20 animate-pulse rounded-[24px] bg-white/[0.06]"
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
