"use client";

import { UrlInput } from "@/components/url-input";
import { useLocale } from "@/contexts/locale-context";

export default function Home() {
  const { d } = useLocale();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16 pt-20">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {d.home.title}
          </h1>
          <p className="mx-auto max-w-md text-lg text-muted-foreground">
            {d.home.subtitle}
          </p>
        </div>

        <UrlInput />

        <p className="max-w-sm text-xs text-muted-foreground">{d.home.footnote}</p>
      </div>
    </main>
  );
}
