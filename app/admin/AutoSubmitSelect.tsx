"use client";

import type { SelectHTMLAttributes } from "react";

type AutoSubmitSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export default function AutoSubmitSelect({
  className = "",
  onChange,
  children,
  style,
  ...props
}: AutoSubmitSelectProps) {
  return (
    <select
      {...props}
      onChange={(event) => {
        onChange?.(event);
        event.currentTarget.form?.requestSubmit();
      }}
      style={{ colorScheme: "dark", ...style }}
      className={`appearance-none rounded-2xl border border-white/10 bg-[#101116] px-4 py-3 font-black text-white outline-none ring-1 ring-white/5 transition focus:border-amber-300/35 focus:ring-amber-300/15 [&_option]:bg-[#101116] [&_option]:text-white ${className}`}
    >
      {children}
    </select>
  );
}
