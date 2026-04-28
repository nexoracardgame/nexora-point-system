export default function MainLoading() {
  return (
    <div className="min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] animate-pulse rounded-[24px] border border-white/5 bg-[linear-gradient(180deg,#0b0d10_0%,#090a0d_100%)] p-3 sm:min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height-sm))] sm:rounded-[26px] sm:p-4 xl:min-h-[calc(var(--app-shell-height)-var(--app-desktop-chrome-height))] xl:p-6">
      <div className="mx-auto h-full max-w-7xl space-y-4">
        <div className="h-8 w-40 rounded-2xl bg-white/8" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-40 rounded-[28px] bg-white/6 md:col-span-2" />
          <div className="h-40 rounded-[28px] bg-white/6" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="h-48 rounded-[28px] bg-white/6" />
          <div className="h-48 rounded-[28px] bg-white/6" />
          <div className="h-48 rounded-[28px] bg-white/6" />
        </div>
      </div>
    </div>
  );
}
