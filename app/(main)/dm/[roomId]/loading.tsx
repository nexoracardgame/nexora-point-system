export default function DmRoomLoading() {
  return (
    <div className="h-full min-h-0 overflow-hidden bg-[#050608] text-white">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-black/75 px-3 py-3 backdrop-blur-xl sm:px-4">
        <div className="mx-auto flex max-w-[980px] items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
          <div className="h-11 w-11 animate-pulse rounded-full bg-white/10" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-36 animate-pulse rounded bg-white/10" />
            <div className="mt-2 h-3 w-20 animate-pulse rounded bg-white/5" />
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-[calc(100%-154px)] max-w-[980px] flex-col justify-end gap-3 px-3 py-4 sm:px-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className={`flex ${
              index % 2 === 0 ? "justify-start" : "justify-end"
            }`}
          >
            <div
              className={`h-14 animate-pulse rounded-[22px] bg-white/10 ${
                index % 2 === 0 ? "w-[58%]" : "w-[46%]"
              }`}
            />
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 border-t border-white/10 bg-[linear-gradient(180deg,rgba(5,6,8,0.18),rgba(5,6,8,0.92)_18%,rgba(5,6,8,0.98)_100%)] px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-2xl sm:px-4">
        <div className="mx-auto flex max-w-[980px] items-center gap-2 rounded-[28px] border border-white/10 bg-black/70 px-3 py-2">
          <div className="h-12 flex-1 animate-pulse rounded-full bg-white/10" />
          <div className="h-12 w-12 animate-pulse rounded-full bg-white/10" />
          <div className="h-12 w-12 animate-pulse rounded-full bg-white/10" />
          <div className="h-12 w-12 animate-pulse rounded-full bg-yellow-400/70" />
        </div>
      </div>
    </div>
  );
}
