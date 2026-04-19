export default function CollectionsLoading() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a1238_0%,#090b12_42%,#05070d_100%)] text-white">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 xl:px-6">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-2xl sm:p-6 xl:p-8">
          <div className="h-4 w-36 animate-pulse rounded bg-white/10" />
          <div className="mt-4 h-10 w-[58%] animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-5 w-[72%] animate-pulse rounded bg-white/5" />
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-[26px] bg-white/[0.05]"
              />
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="min-h-[680px] animate-pulse rounded-[32px] bg-white/[0.05]" />
          <div className="space-y-4">
            <div className="h-[340px] animate-pulse rounded-[30px] bg-white/[0.04]" />
            <div className="h-[260px] animate-pulse rounded-[30px] bg-white/[0.04]" />
          </div>
        </div>
      </div>
    </div>
  );
}
