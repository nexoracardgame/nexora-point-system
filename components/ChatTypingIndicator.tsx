type ChatTypingIndicatorProps = {
  visible: boolean;
  avatar?: string | null;
  name?: string | null;
  compact?: boolean;
  variant?: "default" | "blaze";
};

export default function ChatTypingIndicator({
  visible,
  avatar,
  name,
  compact = false,
  variant = "default",
}: ChatTypingIndicatorProps) {
  if (!visible) {
    return null;
  }

  const isBlaze = variant === "blaze";

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
          <div
            className={`flex items-center gap-0.5 rounded-[16px] px-2.5 py-1.5 shadow-lg ${
              isBlaze
                ? "border border-amber-200/22 bg-[linear-gradient(180deg,rgba(39,29,12,0.96),rgba(17,13,8,0.98))] shadow-[0_0_22px_rgba(214,168,78,0.10)]"
                : "border border-white/10 bg-white/[0.10]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-240ms] ${
                isBlaze ? "bg-amber-100" : "bg-white/92"
              }`}
            />
            <span
              className={`h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-120ms] ${
                isBlaze ? "bg-amber-200/82" : "bg-white/78"
              }`}
            />
            <span
              className={`h-1.5 w-1.5 animate-bounce rounded-full ${
                isBlaze ? "bg-amber-300/70" : "bg-white/64"
              }`}
            />
            <span
              className={`h-1.5 w-2 animate-pulse rounded-full ${
                isBlaze ? "bg-amber-300/42" : "bg-white/42"
              }`}
            />
          </div>
          <div
            className={`px-1 text-[10px] font-bold ${
              isBlaze ? "text-amber-100/46" : "text-white/38"
            }`}
          >
            อีกฝ่ายกำลังพิมพ์
          </div>
        </div>
      </div>
    </div>
  );
}
