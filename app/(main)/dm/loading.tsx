export default function DMLoading() {
  return (
    <div className="mx-auto max-w-[720px] px-3 py-4 text-white">
      <div className="mb-4 h-8 w-24 animate-pulse rounded-xl bg-white/10" />

      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3"
          >
            <div className="h-12 w-12 animate-pulse rounded-full bg-white/10" />
            <div className="min-w-0 flex-1">
              <div className="mb-2 h-4 w-40 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
