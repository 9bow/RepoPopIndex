"use client";

import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/contexts/locale-context";

export function TopNav() {
  const { d } = useLocale();

  return (
    <nav className="pointer-events-auto fixed inset-x-0 top-0 z-50 flex h-12 items-center justify-between px-3 sm:px-5 print:hidden">
      <Link
        href="/"
        className="text-sm font-semibold font-display tracking-tight text-foreground/80 hover:text-foreground transition-colors"
      >
        {d.nav.home}
      </Link>

      <div className="text-xs sm:text-sm">
        <LanguageSwitcher />
      </div>
    </nav>
  );
}
