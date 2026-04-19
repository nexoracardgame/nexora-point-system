export default function AdminLoading() {
  return (
    <div className="space-y-4 p-4">
      <div className="h-8 w-48 animate-pulse rounded-2xl bg-white/10" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-32 animate-pulse rounded-3xl bg-white/8" />
        <div className="h-32 animate-pulse rounded-3xl bg-white/8" />
        <div className="h-32 animate-pulse rounded-3xl bg-white/8" />
      </div>
      <div className="h-[420px] animate-pulse rounded-3xl bg-white/8" />
    </div>
  );
}
