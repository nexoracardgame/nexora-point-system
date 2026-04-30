export default function ProfileLoading() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#111119] p-3 text-white sm:p-6">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(151,139,255,0.20),transparent_34%),radial-gradient(circle_at_12%_32%,rgba(251,113,133,0.11),transparent_24%),radial-gradient(circle_at_88%_70%,rgba(253,224,71,0.10),transparent_20%),linear-gradient(180deg,#171722_0%,#0d0d12_48%,#08080b_100%)]" />
        <div className="absolute inset-0 opacity-[0.23] [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:34px_34px]" />
        <div className="absolute -left-28 top-24 h-[520px] w-[520px] rounded-full border border-white/8" />
        <div className="absolute -left-20 top-32 h-[430px] w-[430px] rounded-full border border-white/6" />
        <div className="absolute -right-24 bottom-6 h-[520px] w-[520px] rounded-full border border-white/7" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-5">
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
