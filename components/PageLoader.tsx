"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function PageLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur">
      <div className="flex flex-col items-center">
        <div className="h-12 w-12 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />

        <div className="mt-4 text-xs tracking-[0.3em] text-white/50">
          LOADING
        </div>
      </div>
    </div>
  );
}