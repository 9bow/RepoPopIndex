"use client";

import Link from "next/link";
import { useLocale } from "@/contexts/locale-context";

export function BottomLinks() {
  const { d } = useLocale();

  return (
    <nav className="pointer-events-auto fixed bottom-3 right-3 z-50 flex items-center gap-3 text-xs text-muted-foreground sm:bottom-4 sm:right-5 sm:text-sm print:hidden">
      <Link
        href="/about"
        className="hover:text-foreground transition-colors"
      >
        {d.nav.about}
      </Link>
      <span aria-hidden className="text-muted-foreground/50">·</span>
      <Link
        href="/methodology"
        className="hover:text-foreground transition-colors"
      >
        {d.nav.methodology}
      </Link>
    </nav>
  );
}
