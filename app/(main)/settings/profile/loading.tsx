export default function ProfileSettingsLoading() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1b1140_0%,#090b12_45%,#05070d_100%)] p-4 text-white sm:p-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="rounded-[36px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
          <div className="h-8 w-40 animate-pulse rounded-xl bg-white/10" />
          <div className="mt-6 h-28 w-28 animate-pulse rounded-full bg-white/10" />
          <div className="mt-6 h-16 animate-pulse rounded-3xl bg-white/10" />
          <div className="mt-4 h-12 animate-pulse rounded-xl bg-white/5" />
          <div className="mt-2 h-24 animate-pulse rounded-xl bg-white/5" />
          <div className="mt-2 h-12 animate-pulse rounded-xl bg-white/5" />
          <div className="mt-2 h-12 animate-pulse rounded-xl bg-white/5" />
        </div>
        <div className="overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.03] shadow-2xl">
          <div className="h-[260px] animate-pulse bg-white/10" />
          <div className="p-6">
            <div className="h-7 w-40 animate-pulse rounded bg-white/10" />
            <div className="mt-3 h-4 w-64 animate-pulse rounded bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
}
