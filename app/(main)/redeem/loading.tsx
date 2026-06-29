export default function Loading() {
  return (
    <div className="min-h-screen bg-[#050507] px-3 py-4 text-white sm:px-5 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="h-[320px] animate-pulse rounded-[32px] bg-white/[0.06]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[260px] animate-pulse rounded-[30px] bg-white/[0.05]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
