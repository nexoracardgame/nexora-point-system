"use client";

import { useEffect } from "react";
import { playGameUiSound } from "@/lib/game-ui-audio";

export default function BattleUiAudio() {
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button,a,[role=button]") : null;
      if (!target || target.hasAttribute("disabled") || target.getAttribute("aria-disabled") === "true") return;
      const label = target.getAttribute("aria-label") || target.textContent || "";
      if (/ปิดเสียง|เปิดเสียง/.test(label)) return;
      playGameUiSound(/กลับ|ปิด|ยกเลิก/.test(label) ? "back" : /สร้าง|เข้าห้อง|พร้อม|ยืนยัน/.test(label) ? "confirm" : "click");
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);
  return null;
}
