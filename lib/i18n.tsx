"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_KEY,
  resolveLocale,
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
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") {
      return resolveLocale(initialLocale);
    }

    const storedLocale = window.localStorage.getItem(LOCALE_COOKIE_KEY);
    return resolveLocale(storedLocale || initialLocale || DEFAULT_LOCALE);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_COOKIE_KEY, nextLocale);
      document.cookie = `${LOCALE_COOKIE_KEY}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = nextLocale;
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "th" ? "en" : "th");
  }, [locale, setLocale]);

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
