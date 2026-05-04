"use client";

import { X } from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";

const DEFAULT_TITLE = "\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2d\u0e35\u0e42\u0e21\u0e08\u0e34";
const CLOSE_LABEL = "\u0e1b\u0e34\u0e14\u0e2d\u0e35\u0e42\u0e21\u0e08\u0e34";
const SEARCH_LABEL = "\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e2d\u0e35\u0e42\u0e21\u0e08\u0e34";

export default function ChatEmojiPicker({
  onSelect,
  onClose,
  title = DEFAULT_TITLE,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  title?: string;
}) {
  return (
    <div className="w-[min(340px,calc(100vw-28px))] overflow-hidden rounded-[22px] border border-white/10 bg-[#101116]/98 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.62)] backdrop-blur-2xl">
      <div className="mb-2 flex items-center justify-between gap-3 px-2 py-1.5">
        <div className="text-[11px] font-black uppercase text-white/45">
          {title}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07] text-white/62 transition hover:bg-white/[0.13] hover:text-white"
          aria-label={CLOSE_LABEL}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-hidden rounded-[18px] bg-[#0b0c10]">
        <EmojiPicker
          onEmojiClick={(emojiData) => onSelect(emojiData.emoji)}
          theme={Theme.DARK}
          width="100%"
          height={380}
          lazyLoadEmojis
          previewConfig={{
            showPreview: false,
          }}
          searchPlaceHolder={SEARCH_LABEL}
        />
      </div>
    </div>
  );
}
