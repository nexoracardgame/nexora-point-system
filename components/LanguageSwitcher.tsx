"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded-2xl border border-white/8 bg-white/[0.03] p-1 shadow-[0_0_24px_rgba(0,0,0,0.18)]">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.04] text-amber-300">
        <Languages className="h-4 w-4" />
      </div>

      <button
        type="button"
        onClick={() => setLocale("th")}
        aria-pressed={locale === "th"}
        className={`rounded-xl px-2.5 py-1.5 text-[11px] font-black transition sm:px-3 ${
          locale === "th"
            ? "bg-amber-300/14 text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.12)]"
            : "text-white/55 hover:text-white/85"
        }`}
        title={t("layout.lang.th")}
      >
        TH
      </button>

      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`rounded-xl px-2.5 py-1.5 text-[11px] font-black transition sm:px-3 ${
          locale === "en"
            ? "bg-amber-300/14 text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.12)]"
            : "text-white/55 hover:text-white/85"
        }`}
        title={t("layout.lang.en")}
      >
        EN
      </button>
    </div>
  );
}
