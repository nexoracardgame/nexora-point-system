export default function Loading() {
  return (
    <div className="space-y-5 text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="h-3 w-32 animate-pulse rounded-full bg-white/10" />
          <div className="mt-3 h-9 w-64 animate-pulse rounded-2xl bg-white/10" />
        </div>
        <div className="h-11 w-36 animate-pulse rounded-2xl bg-white/10" />
      </div>
      <div className="h-32 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.04]" />
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-[24px] border border-white/10 bg-white/[0.04]"
          />
        ))}
      </div>
      <div className="h-36 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.04]" />
      <div className="h-72 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.04]" />
    </div>
  );
}
