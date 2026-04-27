export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#23124d_0%,#0a0b10_42%,#05070d_100%)] p-3 text-white sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] shadow-[0_30px_120px_rgba(0,0,0,0.5)] sm:rounded-[42px]">
          <div className="h-[250px] animate-pulse bg-white/[0.06] sm:h-[360px] xl:h-[430px]" />
          <div className="space-y-5 px-4 pb-6 sm:px-8 xl:px-10">
            <div className="-mt-14 flex items-end gap-4 sm:-mt-20">
              <div className="h-24 w-24 shrink-0 animate-pulse rounded-full bg-white/12 ring-4 ring-white/10 sm:h-32 sm:w-32" />
              <div className="min-w-0 flex-1 space-y-3 pb-2">
                <div className="h-4 w-36 animate-pulse rounded-full bg-white/10" />
                <div className="h-10 w-3/4 animate-pulse rounded-2xl bg-white/10" />
                <div className="h-4 w-1/2 animate-pulse rounded-full bg-white/10" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-[22px] border border-white/8 bg-white/[0.045]"
                />
              ))}
            </div>
          </div>
        </div>
        <div className="h-44 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.035] sm:rounded-[40px]" />
      </div>
    </div>
  );
}
