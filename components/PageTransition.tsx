"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 120); // delay สั้นๆ ให้เกิด fade
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div
      className={`transition-all duration-300 ease-out ${
        visible
          ? "opacity-100 scale-100 blur-0"
          : "opacity-0 scale-[0.98] blur-[6px]"
      }`}
    >
      {children}
    </div>
  );
}