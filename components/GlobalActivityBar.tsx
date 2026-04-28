"use client";

import { useEffect, useRef, useState } from "react";
import { getUiActivityEventName } from "@/lib/ui-activity";

type UiActivityDetail =
  | { type: "start"; id: string }
  | { type: "end"; id: string };

export default function GlobalActivityBar() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const activeCountRef = useRef(0);
  const settleTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const progressTimer = window.setInterval(() => {
      if (activeCountRef.current <= 0) {
        return;
      }

      setProgress((current) => {
        if (current < 28) return Math.min(current + 11, 28);
        if (current < 56) return Math.min(current + 6, 56);
        if (current < 78) return Math.min(current + 3.5, 78);
        if (current < 90) return Math.min(current + 1.25, 90);
        return Math.min(current + 0.35, 94);
      });
    }, 110);

    const handleActivity = (event: Event) => {
      const detail = (event as CustomEvent<UiActivityDetail>).detail;

      if (!detail) {
        return;
      }

      if (settleTimeoutRef.current) {
        window.clearTimeout(settleTimeoutRef.current);
        settleTimeoutRef.current = null;
      }

      if (detail.type === "start") {
        activeCountRef.current += 1;
        setVisible(true);
        setProgress((current) => (current > 12 ? current : 12));
        return;
      }

      activeCountRef.current = Math.max(0, activeCountRef.current - 1);

      if (activeCountRef.current === 0) {
        setProgress(100);
        settleTimeoutRef.current = window.setTimeout(() => {
          setVisible(false);
          setProgress(0);
          settleTimeoutRef.current = null;
        }, 260);
      }
    };

    window.addEventListener(
      getUiActivityEventName(),
      handleActivity as EventListener
    );

    return () => {
      window.clearInterval(progressTimer);
      window.removeEventListener(
        getUiActivityEventName(),
        handleActivity as EventListener
      );
      if (settleTimeoutRef.current) {
        window.clearTimeout(settleTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-[2200] transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden="true"
    >
      <div className="h-[3px] w-full bg-transparent">
        <div
          className="h-full rounded-r-full bg-[linear-gradient(90deg,#f6b73c_0%,#ffdf7a_48%,#f6b73c_100%)] shadow-[0_0_18px_rgba(246,183,60,0.55)] transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
