export default function Loading() {
  return (
    <div className="min-h-screen bg-[#050507] px-3 py-4 text-white sm:px-5 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="h-[250px] animate-pulse rounded-[32px] border border-white/8 bg-white/[0.04]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              key={index}
              className="h-[430px] animate-pulse rounded-[30px] border border-white/8 bg-white/[0.04]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
