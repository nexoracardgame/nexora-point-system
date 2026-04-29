export default function DMLoading() {
  return (
    <div className="min-h-full overflow-hidden bg-[#f4f0f7] text-[#08080a]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,0.92),transparent_26%),radial-gradient(circle_at_78%_0%,rgba(255,217,102,0.22),transparent_22%),linear-gradient(180deg,#f8f5fb_0%,#e7e8f7_100%)]" />
      <div className="relative mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
        <section className="overflow-hidden rounded-[34px] bg-[#f8f7fb] p-4 shadow-[0_28px_90px_rgba(60,50,80,0.14)] ring-1 ring-black/5 sm:rounded-[48px] sm:p-7">
          <div className="h-4 w-36 animate-pulse rounded-full bg-black/10" />
          <div className="mt-3 h-12 w-28 animate-pulse rounded-2xl bg-black/10" />

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 2 }).map((_, sectionIndex) => (
              <div
                key={sectionIndex}
                className="rounded-[30px] bg-white p-4 shadow-[0_18px_34px_rgba(20,20,30,0.08)]"
              >
                <div className="mb-4 h-8 w-40 animate-pulse rounded-xl bg-black/8" />
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 rounded-[28px] bg-[#f4f3f8] p-3"
                    >
                      <div className="h-12 w-12 animate-pulse rounded-full bg-white" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 h-4 w-40 animate-pulse rounded bg-black/10" />
                        <div className="h-3 w-24 animate-pulse rounded bg-black/5" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
