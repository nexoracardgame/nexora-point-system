type ChatTypingIndicatorProps = {
  visible: boolean;
  avatar?: string | null;
  name?: string | null;
  compact?: boolean;
};

export default function ChatTypingIndicator({
  visible,
  avatar,
  name,
  compact = false,
}: ChatTypingIndicatorProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className={`flex justify-start ${compact ? "mb-2" : "mb-3"}`}>
      <div className="flex max-w-[86%] items-end gap-2">
        {!compact ? (
          <img
            src={avatar || "/avatar.png"}
            alt={name || "profile"}
            className="h-7 w-7 shrink-0 rounded-full border border-white/10 object-cover"
            onError={(event) => {
              event.currentTarget.src = "/avatar.png";
            }}
          />
        ) : null}
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-1 rounded-[20px] border border-white/10 bg-white/[0.10] px-3.5 py-2.5 shadow-lg">
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-white/92 [animation-delay:-240ms]" />
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-white/78 [animation-delay:-120ms]" />
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-white/64" />
            <span className="h-2.5 w-3.5 animate-pulse rounded-full bg-white/42" />
          </div>
          <div className="px-1 text-[10px] font-bold text-white/38">
            อีกฝ่ายกำลังพิมพ์
          </div>
        </div>
      </div>
    </div>
  );
}
