"use client";

import { useEffect, useState } from "react";

export default function RouteLoadingBar() {
  const [progress, setProgress] = useState(18);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current < 42) return Math.min(current + 8, 42);
        if (current < 68) return Math.min(current + 5, 68);
        if (current < 84) return Math.min(current + 2.2, 84);
        return Math.min(current + 0.7, 94);
      });
    }, 120);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="pointer-events-none px-3 pb-3 pt-4 sm:px-4 xl:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-full border border-white/6 bg-white/[0.03] shadow-[0_12px_30px_rgba(0,0,0,0.24)]">
          <div
            className="h-1.5 rounded-r-full bg-[linear-gradient(90deg,#f6b73c_0%,#ffdf7a_48%,#f6b73c_100%)] shadow-[0_0_22px_rgba(246,183,60,0.5)] transition-[width] duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
