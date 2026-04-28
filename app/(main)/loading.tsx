export default function MainLoading() {
  return (
    <div className="pointer-events-none px-3 pb-3 pt-4 sm:px-4 xl:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-full border border-white/6 bg-white/[0.03]">
          <div className="h-1.5 w-1/3 animate-[shimmer_1.1s_linear_infinite] bg-[linear-gradient(90deg,rgba(250,204,21,0)_0%,rgba(250,204,21,0.72)_50%,rgba(250,204,21,0)_100%)] bg-[length:200%_100%]" />
        </div>
      </div>
    </div>
  );
}
