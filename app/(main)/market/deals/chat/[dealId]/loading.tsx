export default function LoadingDealChatRoom() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 pb-[env(safe-area-inset-bottom)] text-white">
      <div className="w-full max-w-[980px] animate-pulse rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-white/10" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-44 rounded-full bg-white/10" />
            <div className="mt-2 h-3 w-32 rounded-full bg-white/5" />
          </div>
          <div className="h-14 w-10 rounded-xl bg-white/10" />
        </div>

        <div className="mt-6 h-24 rounded-[24px] bg-cyan-400/10" />

        <div className="mt-6 space-y-3">
          <div className="h-16 w-[76%] rounded-[24px] bg-white/8" />
          <div className="ml-auto h-16 w-[64%] rounded-[24px] bg-yellow-400/15" />
          <div className="h-16 w-[70%] rounded-[24px] bg-white/8" />
        </div>
      </div>
    </div>
  );
}
