"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  translate,
  type Locale,
} from "@/lib/i18n-core";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export type { Locale } from "@/lib/i18n-core";
export {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_KEY,
  getLocaleTag,
  resolveLocale,
  translate,
} from "@/lib/i18n-core";

export function LanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const locale = DEFAULT_LOCALE;

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    void nextLocale;
    if (typeof window !== "undefined") {
      document.documentElement.lang = DEFAULT_LOCALE;
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(DEFAULT_LOCALE);
  }, [setLocale]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale, setLocale, toggleLocale]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }

  return context;
}
