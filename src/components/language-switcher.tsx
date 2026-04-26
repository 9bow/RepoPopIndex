"use client";

import { useLocale } from "@/contexts/locale-context";
import type { Locale } from "@/lib/i18n/dictionary";

export function LanguageSwitcher() {
  const { locale, setLocale, d } = useLocale();

  return (
    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
      <span className="sr-only" id="lang-label">
        {d.language.label}
      </span>
      <label htmlFor="lang-select" className="max-sm:sr-only">
        {d.language.label}
      </label>
      <select
        id="lang-select"
        aria-labelledby="lang-label"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="h-8 sm:h-9 rounded-full border border-border bg-background/80 px-2.5 backdrop-blur-sm text-foreground shadow-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="en">{d.language.en}</option>
        <option value="ko">{d.language.ko}</option>
      </select>
    </div>
  );
}
