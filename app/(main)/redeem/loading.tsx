export default function RedeemLoading() {
  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(251,191,36,0.18),transparent_26%),radial-gradient(circle_at_0%_45%,rgba(124,58,237,0.16),transparent_24%),radial-gradient(circle_at_100%_75%,rgba(34,211,238,0.10),transparent_26%),linear-gradient(180deg,#0b0b10_0%,#050507_100%)]" />
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 xl:px-6">
        <div className="overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.04] p-4 backdrop-blur-2xl sm:rounded-[34px] sm:p-6 xl:p-8">
          <div className="h-5 w-36 animate-pulse rounded bg-white/10" />
          <div className="mt-4 h-10 w-[60%] animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-5 w-[72%] animate-pulse rounded bg-white/5" />

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-[24px] bg-white/[0.05]"
              />
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[28px] border border-white/8 bg-white/[0.03] p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="h-[120px] animate-pulse rounded-[22px] bg-white/[0.06] sm:w-[152px]" />
                <div className="min-w-0 flex-1">
                  <div className="h-6 w-32 animate-pulse rounded bg-white/[0.06]" />
                  <div className="mt-3 h-8 w-[70%] animate-pulse rounded bg-white/[0.08]" />
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {Array.from({ length: 4 }).map((__, innerIndex) => (
                      <div
                        key={innerIndex}
                        className="h-12 animate-pulse rounded bg-white/[0.05]"
                      />
                    ))}
                  </div>
                  <div className="mt-4 h-12 w-48 animate-pulse rounded-2xl bg-white/[0.07]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
